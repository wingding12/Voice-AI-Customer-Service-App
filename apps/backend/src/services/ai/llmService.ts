/**
 * LLM Service - Unified AI Agent and Copilot
 * 
 * Uses the SAME prompts and knowledge base as Retell voice agent
 * to ensure consistent behavior across voice and text channels.
 * 
 * - Text Chat: Uses Gemini with Retell's prompts
 * - Voice Calls: Uses Retell's native voice AI
 * 
 * Both share identical personality, knowledge base, and policies.
 */

import { GoogleGenerativeAI, GenerativeModel, Content } from "@google/generative-ai";
import { env, hasGeminiConfig, hasRetellConfig } from "../../config/env.js";
import { smartSearch, type RelevantArticle } from "../copilot/ragService.js";
import { getSession } from "../state/sessionStore.js";
import type { TranscriptEntry, CopilotSuggestion } from "shared-types";
// Import the SAME prompts used by Retell voice agent
import { 
  UTILITY_VOICE_AGENT_PROMPT, 
  UTILITY_KNOWLEDGE_BASE,
  getFullVoiceAgentPrompt,
} from "../voice/retellClient.js";

// Singleton Gemini client
let genAI: GoogleGenerativeAI | null = null;
let agentModel: GenerativeModel | null = null;
let copilotModel: GenerativeModel | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!hasGeminiConfig()) {
    throw new Error("Gemini is not configured. Set GEMINI_API_KEY in environment.");
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);
  }
  return genAI;
}

function getAgentModel(): GenerativeModel {
  if (!agentModel) {
    const client = getGeminiClient();
    agentModel = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: UNIFIED_AGENT_PROMPT,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
        topP: 0.9,
      },
    });
  }
  return agentModel;
}

function getCopilotModel(): GenerativeModel {
  if (!copilotModel) {
    const client = getGeminiClient();
    copilotModel = client.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: COPILOT_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 300,
        topP: 0.85,
      },
    });
  }
  return copilotModel;
}

// ===========================================
// Unified System Prompts (Same as Retell)
// ===========================================

/**
 * Unified agent prompt - adapts Retell's voice prompt for text chat
 * Uses the SAME knowledge base and personality
 */
const UNIFIED_AGENT_PROMPT = `You are a friendly AI customer service assistant for a utility company (electricity and gas). Your name is "Utility Assistant".

CHANNEL ADAPTATION:
You handle both voice calls and text chats. For text chat:
- Use proper formatting (bullet points, line breaks)
- Can be slightly more detailed than voice
- Include relevant phone numbers and links when helpful

YOUR SPECIALIZATION - Utility Customer Support:
- Billing questions and bill explanations
- Payment options and arrangements  
- Power outages and service interruptions
- Starting, stopping, or transferring service
- Meter questions
- Energy efficiency programs
- Payment assistance programs

EMERGENCY PROTOCOL - GAS:
If customer mentions gas smell, leak, or rotten egg odor:
1. IMMEDIATELY tell them to leave the building
2. Do NOT operate any electrical switches or phones inside
3. Call 911 and 1-800-GAS-LEAK from outside
4. This is the HIGHEST PRIORITY - address it before anything else

CONVERSATION STYLE:
- Greet warmly on first message
- Be empathetic: "I understand that's frustrating..."
- Confirm understanding: "So you're asking about..."
- Offer clear next steps
- If you can't help: "Let me connect you with a representative who can help with that."

LIMITATIONS - Be honest:
- Cannot access actual account information
- Cannot process real payments
- Offer to transfer to a human when needed

${UTILITY_KNOWLEDGE_BASE}`;

const COPILOT_SYSTEM_PROMPT = `You are an AI copilot assisting a human customer service representative at a utility company. Provide brief, actionable insights.

YOUR ROLE:
- Analyze the conversation and provide helpful context
- Suggest relevant responses or actions
- Alert to important issues (frustration, emergencies)
- Include relevant policy snippets when useful

OUTPUT FORMAT - Always respond with this JSON structure:
{
  "insight": "Brief 1-2 sentence summary of what's happening",
  "suggestion": "What the rep should consider doing (1-2 sentences)",
  "snippet": "Relevant policy or info snippet if applicable (optional, 1-2 sentences max)",
  "priority": "low|medium|high|critical",
  "type": "info|action|warning"
}

PRIORITY LEVELS:
- critical: Gas emergency, safety issue
- high: Frustrated customer, billing dispute, disconnection
- medium: Payment arrangement, high bill concern
- low: General inquiry, routine request

ONLY PROVIDE NEW INSIGHTS when:
- Customer reveals new information
- Sentiment changes significantly  
- A new topic/intent is detected
- Action is needed from the rep

Keep snippets VERY brief - just the essential policy point, not full explanations.

${UTILITY_KNOWLEDGE_BASE}`;

// ===========================================
// Conversation Context
// ===========================================

interface ConversationContext {
  sessionId: string;
  transcript: TranscriptEntry[];
  lastAnalyzedIndex: number;
  detectedIntents: string[];
  customerSentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
  isEmergency: boolean;
  lastCopilotUpdate: number;
}

// Context cache
const contextCache = new Map<string, ConversationContext>();

function getContext(sessionId: string): ConversationContext {
  let context = contextCache.get(sessionId);
  if (!context) {
    context = {
      sessionId,
      transcript: [],
      lastAnalyzedIndex: 0,
      detectedIntents: [],
      customerSentiment: 'neutral',
      isEmergency: false,
      lastCopilotUpdate: 0,
    };
    contextCache.set(sessionId, context);
  }
  return context;
}

function updateContextFromTranscript(context: ConversationContext, transcript: TranscriptEntry[]): void {
  context.transcript = transcript;
  
  // Detect emergency
  const allText = transcript.map(t => t.text.toLowerCase()).join(" ");
  context.isEmergency = 
    allText.includes("gas leak") ||
    allText.includes("smell gas") ||
    allText.includes("rotten egg") ||
    allText.includes("gas smell");
  
  // Detect sentiment from recent customer messages
  const recentCustomer = transcript
    .filter(t => t.speaker === "CUSTOMER")
    .slice(-3)
    .map(t => t.text.toLowerCase())
    .join(" ");
  
  const frustratedWords = ["ridiculous", "unacceptable", "terrible", "furious", "angry", "worst", "sue"];
  const negativeWords = ["frustrated", "annoyed", "disappointed", "unhappy", "problem", "wrong"];
  
  if (frustratedWords.some(w => recentCustomer.includes(w))) {
    context.customerSentiment = 'frustrated';
  } else if (negativeWords.some(w => recentCustomer.includes(w))) {
    context.customerSentiment = 'negative';
  } else {
    context.customerSentiment = 'neutral';
  }
}

// ===========================================
// AI Agent - Customer-Facing Responses
// ===========================================

export interface AIAgentResponse {
  message: string;
  shouldEscalate: boolean;
  escalationReason?: string;
  confidence: number;
}

/**
 * Generate AI agent response using Gemini
 * Let Gemini handle all conversations naturally within its specialized context
 */
export async function generateAgentResponse(
  sessionId: string,
  transcript: TranscriptEntry[]
): Promise<AIAgentResponse> {
  const context = getContext(sessionId);
  updateContextFromTranscript(context, transcript);
  
  // Use Gemini for all responses
  if (hasGeminiConfig()) {
    try {
      const response = await generateGeminiAgentResponse(transcript, context);
      
      // Detect if Gemini's response indicates escalation
      if (context.isEmergency) {
        response.shouldEscalate = true;
        response.escalationReason = "GAS_EMERGENCY";
      }
      
      return response;
    } catch (error) {
      console.error("Gemini agent error:", error);
    }
  }
  
  // Fallback responses when Gemini is not available
  return generateFallbackResponse(transcript, context);
}

/**
 * Generate fallback response when Gemini is unavailable
 */
function generateFallbackResponse(
  transcript: TranscriptEntry[],
  context: ConversationContext
): AIAgentResponse {
  const lastMessage = transcript[transcript.length - 1]?.text.toLowerCase() || "";
  
  // Emergency handling
  if (context.isEmergency) {
    return {
      message: "⚠️ If you smell gas, please leave the building immediately, don't use any electrical switches, and call 911 from outside. Our emergency line is 1-800-GAS-LEAK. I'm connecting you with our emergency team now.",
      shouldEscalate: true,
      escalationReason: "GAS_EMERGENCY",
      confidence: 1.0,
    };
  }
  
  // Human request
  if (lastMessage.includes("human") || lastMessage.includes("representative") || lastMessage.includes("agent") || lastMessage.includes("real person")) {
    return {
      message: "Of course! I'll connect you with a customer service representative right away. Please hold for just a moment.",
      shouldEscalate: true,
      escalationReason: "CUSTOMER_REQUEST",
      confidence: 0.9,
    };
  }
  
  // Billing
  if (lastMessage.includes("bill") || lastMessage.includes("charge") || lastMessage.includes("payment")) {
    return {
      message: "I can help with billing questions! Bills are due 21 days after the statement date. Payment options include: online (free), auto-pay ($2/month discount), phone ($2.50 fee), or mail. Would you like more details about your specific question?",
      shouldEscalate: false,
      confidence: 0.7,
    };
  }
  
  // Outage
  if (lastMessage.includes("outage") || lastMessage.includes("power out") || lastMessage.includes("no power")) {
    return {
      message: "I'm sorry to hear you're experiencing a power issue. Please check your circuit breaker first. If that's not the issue, you can report outages at outage.utilitycompany.com or call 1-800-OUTAGES. What's your service address so I can check for known outages in your area?",
      shouldEscalate: false,
      confidence: 0.7,
    };
  }
  
  // Default greeting/help
  return {
    message: "Hello! I'm your utility service assistant. I can help with billing, payments, outages, starting or stopping service, and more. What can I help you with today?",
    shouldEscalate: false,
    confidence: 0.5,
  };
}

async function generateGeminiAgentResponse(
  transcript: TranscriptEntry[],
  context: ConversationContext
): Promise<AIAgentResponse> {
  const client = getGeminiClient();
  
  // Use generateContent with full conversation context (more reliable than chat API)
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 400,
      topP: 0.9,
    },
  });
  
  // Get the last customer message
  const lastMessage = transcript[transcript.length - 1];
  if (!lastMessage) {
    return {
      message: "Hello! I'm your utility service assistant. How can I help you today?",
      shouldEscalate: false,
      confidence: 0.6,
    };
  }
  
  // Check if this is a scenario session with pre-loaded context
  const session = await getSession(context.sessionId);
  const scenarioContext = session?.metadata?.aiContext as string | undefined;
  
  // Build conversation context as text
  const recentMessages = transcript.slice(-8); // Last 8 messages for context
  let conversationHistory = "";
  if (recentMessages.length > 1) {
    conversationHistory = "CONVERSATION SO FAR:\n" + 
      recentMessages.slice(0, -1)
        .filter(m => !m.text.startsWith("["))
        .map(m => `${m.speaker === "CUSTOMER" ? "Customer" : "Assistant"}: ${m.text}`)
        .join("\n") + 
      "\n\n";
  }
  
  // Current message to respond to
  let currentMessage = lastMessage.text;
  if (currentMessage.startsWith("[")) {
    currentMessage = "(Customer just returned from speaking with a human representative)";
  }
  
  // Search database for additional context (supplements the built-in knowledge base)
  const articles = await smartSearch(currentMessage, 2);
  let dynamicContext = "";
  if (articles.length > 0 && articles[0].similarity > 0.6) {
    dynamicContext = "\n\nADDITIONAL CONTEXT FROM DATABASE:\n" + 
      articles.slice(0, 2).map(a => `• ${a.title}: ${a.content.substring(0, 200)}`).join("\n");
  }
  
  // Build the prompt using unified agent prompt (includes knowledge base)
  // Include scenario context if available for demo scenarios
  const scenarioInstructions = scenarioContext ? `
${scenarioContext}

` : '';

  const prompt = `${UNIFIED_AGENT_PROMPT}

${scenarioInstructions}${conversationHistory}CUSTOMER'S CURRENT MESSAGE: ${currentMessage}
${dynamicContext}
${context.customerSentiment === 'frustrated' ? '\n⚠️ Customer seems frustrated - be extra empathetic.\n' : ''}
Respond naturally as the utility assistant. Be helpful and concise. For text chat, you may use formatting like bullet points. Continue the conversation from where it left off.`;

  console.log(`🤖 Retell-unified Gemini request, transcript: ${transcript.length} msgs${scenarioContext ? ' (SCENARIO)' : ''}`);
  
  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  console.log(`✅ AI response: ${responseText.substring(0, 100)}...`);
  
  // Check if response suggests escalation to human
  const lowerResponse = responseText.toLowerCase();
  const shouldEscalate = 
    lowerResponse.includes("connect you with") ||
    lowerResponse.includes("transfer you") ||
    lowerResponse.includes("human representative") ||
    lowerResponse.includes("speak with a representative") ||
    lowerResponse.includes("connecting you");
  
  // Determine escalation reason
  let escalationReason: string | undefined;
  if (shouldEscalate) {
    const lastCustomerMsg = lastMessage.text.toLowerCase();
    if (lastCustomerMsg.includes("human") || lastCustomerMsg.includes("representative") || lastCustomerMsg.includes("real person") || lastCustomerMsg.includes("agent")) {
      escalationReason = "CUSTOMER_REQUEST";
    } else {
      escalationReason = "AI_SUGGESTED";
    }
  }
  
  return {
    message: responseText,
    shouldEscalate,
    escalationReason,
    confidence: 0.9,
  };
}

// ===========================================
// AI Copilot - Agent-Facing Suggestions
// ===========================================

export interface CopilotAnalysis {
  suggestions: CopilotSuggestion[];
  contextSummary: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction?: string;
}

interface GeminiCopilotResponse {
  insight: string;
  suggestion: string;
  snippet?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  type: 'info' | 'action' | 'warning';
}

/**
 * Generate dynamic copilot analysis using Gemini
 * Only updates when new information is needed
 */
export async function generateCopilotAnalysis(
  sessionId: string,
  transcript: TranscriptEntry[]
): Promise<CopilotAnalysis> {
  const context = getContext(sessionId);
  updateContextFromTranscript(context, transcript);
  
  // Check if we need to update (new messages since last analysis)
  const needsUpdate = 
    transcript.length > context.lastAnalyzedIndex ||
    context.isEmergency ||
    context.customerSentiment === 'frustrated';
  
  if (!needsUpdate && context.lastCopilotUpdate > 0) {
    // No new info, return minimal response
    return {
      suggestions: [],
      contextSummary: `${transcript.length} messages | Sentiment: ${context.customerSentiment}`,
      priority: 'low',
    };
  }
  
  // Update tracking
  context.lastAnalyzedIndex = transcript.length;
  context.lastCopilotUpdate = Date.now();
  
  const suggestions: CopilotSuggestion[] = [];
  let priority: CopilotAnalysis['priority'] = 'low';
  
  // Emergency takes precedence
  if (context.isEmergency) {
    suggestions.push({
      type: "ACTION",
      title: "🚨 GAS EMERGENCY",
      content: "Customer reporting potential gas leak. Follow emergency protocol immediately.",
      confidenceScore: 1.0,
      metadata: { priority: "CRITICAL" },
    });
    return {
      suggestions,
      contextSummary: "EMERGENCY: Potential gas leak reported",
      priority: 'critical',
      recommendedAction: "Transfer to emergency dispatch immediately",
    };
  }
  
  // Use Gemini for dynamic analysis
  if (hasGeminiConfig() && transcript.length >= 2) {
    try {
      const geminiSuggestion = await generateGeminiCopilotSuggestion(transcript, context);
      if (geminiSuggestion) {
        priority = geminiSuggestion.priority;
        
        // Build suggestion with snippet
        let content = geminiSuggestion.insight;
        if (geminiSuggestion.suggestion) {
          content += `\n\n**Suggestion:** ${geminiSuggestion.suggestion}`;
        }
        if (geminiSuggestion.snippet) {
          content += `\n\n📋 *${geminiSuggestion.snippet}*`;
        }
        
        suggestions.push({
          type: geminiSuggestion.type === 'warning' ? "ACTION" : "INFO",
          title: getTitleForType(geminiSuggestion.type, geminiSuggestion.priority),
          content,
          confidenceScore: getPriorityScore(geminiSuggestion.priority),
          metadata: { 
            priority: geminiSuggestion.priority.toUpperCase(),
            source: "gemini",
          },
        });
      }
    } catch (error) {
      console.error("Gemini copilot error:", error);
    }
  }
  
  // Add frustration alert if detected
  if (context.customerSentiment === 'frustrated' && !suggestions.some(s => s.title.includes('Frustrated'))) {
    suggestions.push({
      type: "ACTION",
      title: "⚠️ Customer Frustrated",
      content: "Customer appears frustrated. Acknowledge their feelings, apologize sincerely, and focus on solutions.\n\n📋 *Goodwill credit up to $25 within rep authority.*",
      confidenceScore: 0.9,
      metadata: { priority: "HIGH" },
    });
    priority = 'high';
  }
  
  return {
    suggestions,
    contextSummary: `${transcript.length} msgs | ${context.customerSentiment} sentiment`,
    priority,
    recommendedAction: suggestions.length > 0 ? suggestions[0].content.split('\n')[0] : undefined,
  };
}

async function generateGeminiCopilotSuggestion(
  transcript: TranscriptEntry[],
  context: ConversationContext
): Promise<GeminiCopilotResponse | null> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 250,
    },
  });
  
  // Get recent messages
  const recentTranscript = transcript.slice(-6);
  const conversationText = recentTranscript
    .filter(t => !t.text.startsWith("["))
    .map(t => `${t.speaker === "CUSTOMER" ? "Customer" : t.speaker === "AI" ? "AI" : "Agent"}: ${t.text}`)
    .join("\n");
  
  // Search for relevant knowledge
  const lastCustomerMsg = [...transcript].reverse().find(t => t.speaker === "CUSTOMER")?.text || "";
  const articles = await smartSearch(lastCustomerMsg, 2);
  
  let kbContext = "";
  if (articles.length > 0 && articles[0].similarity > 0.4) {
    kbContext = `\n\nRelevant policies:\n${articles.map(a => `- ${a.title}: ${a.content.substring(0, 100)}`).join("\n")}`;
  }
  
  const prompt = `You are a copilot helping a customer service rep at a utility company. Analyze this conversation and provide a brief insight.

CONVERSATION:
${conversationText}

CONTEXT:
- Customer sentiment: ${context.customerSentiment}
${kbContext}

Respond with ONLY valid JSON in this exact format:
{"insight":"1-2 sentence summary","suggestion":"what rep should do","snippet":"brief policy if relevant or null","priority":"low|medium|high|critical","type":"info|action|warning"}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log(`🎯 Copilot raw response: ${responseText.substring(0, 150)}`);
    
    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as GeminiCopilotResponse;
      return parsed;
    }
  } catch (error) {
    console.error("Gemini copilot error:", error);
  }
  
  return null;
}

function getTitleForType(type: string, priority: string): string {
  if (priority === 'critical') return "🚨 Critical Alert";
  if (priority === 'high') return "⚠️ Important";
  if (type === 'warning') return "⚡ Action Needed";
  if (type === 'action') return "💡 Suggestion";
  return "📋 Info";
}

function getPriorityScore(priority: string): number {
  switch (priority) {
    case 'critical': return 1.0;
    case 'high': return 0.9;
    case 'medium': return 0.7;
    default: return 0.5;
  }
}

// ===========================================
// Context Management
// ===========================================

/**
 * Clear context for a session
 */
export function clearContext(sessionId: string): void {
  contextCache.delete(sessionId);
}

/**
 * Update context with new transcript
 */
export async function updateContext(
  sessionId: string,
  transcript: TranscriptEntry[]
): Promise<ConversationContext> {
  const context = getContext(sessionId);
  updateContextFromTranscript(context, transcript);
  return context;
}

/**
 * Check if LLM (Gemini) is available
 */
export function isLLMAvailable(): boolean {
  return hasGeminiConfig();
}
