/**
 * Retell AI Voice Client
 *
 * Retell provides a complete voice AI solution:
 * - Speech-to-Text (STT)
 * - Language Model (LLM) processing
 * - Text-to-Speech (TTS)
 *
 * All in a single low-latency WebSocket connection.
 */

import Retell from "retell-sdk";
import { createHmac } from "crypto";
import { env, hasRetellConfig, hasRetellChatConfig } from "../../config/env.js";

// Singleton Retell client
let retellClient: Retell | null = null;

/**
 * Utility-focused system prompt for the Retell voice agent
 */
export const UTILITY_VOICE_AGENT_PROMPT = `You are a friendly AI voice assistant for a utility company (electricity and gas). Your name is "Utility Assistant".

IMPORTANT - YOU ARE A VOICE ASSISTANT:
- Keep responses SHORT (1-3 sentences max)
- Speak naturally, conversationally
- Avoid bullet points or formatting - this is speech
- Use simple, clear language
- Pause naturally between thoughts

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
1. IMMEDIATELY say: "This could be a gas emergency. Please leave your home right now and call 9-1-1 from outside."
2. Do NOT continue the normal conversation
3. Say you're transferring to emergency services

CONVERSATION STYLE:
- Greet warmly: "Hi! Thanks for calling. How can I help you today?"
- Be empathetic: "I understand that's frustrating..."
- Confirm understanding: "So you're asking about..."
- Offer clear next steps
- If you can't help: "Let me connect you with a representative who can help with that."

LIMITATIONS - Be honest:
- Cannot access actual account information
- Cannot process real payments
- Offer to transfer to a human when needed`;

/**
 * Knowledge base content for the voice agent
 * This provides specific policy information the agent can reference
 */
export const UTILITY_KNOWLEDGE_BASE = `
KNOWLEDGE BASE - Use this information to answer customer questions accurately:

=== BILLING & PAYMENTS ===
• Bills due 21 days after statement date
• Late fee: $10 or 1.5% of balance, whichever is greater
• Payment methods: Online (free), Auto-pay ($2/month discount), Phone ($2.50 fee), Mail (allow 5-7 days)
• Average residential bill: $85-150/month depending on usage and season
• E-billing available with $1/month paperless discount
• Payment confirmation takes 1-2 business days to reflect

=== PAYMENT ASSISTANCE ===
• Payment plans: Spread balance over 3-12 months, must stay current on new charges
• LIHEAP: Federal assistance program, apply through Community Action Agency
• Senior discount: 15% off basic charge for customers 65+
• Medical baseline: Additional energy at lowest rate for medical equipment
• Hardship program: One-time forgiveness up to $300
• Winter protection: No disconnects November through March for residential

=== SERVICE FEES ===
• New service connection: $35 standard, $75 same-day
• Reconnection after disconnect: $50 standard, $100 same-day
• Deposit for new customers: $200 or 2x average monthly bill
• Deposit refund: After 12 months of on-time payments
• Meter test: Free if meter is faulty, $75 if accurate
• Returned payment fee: $25

=== OUTAGES ===
• Report outages: 1-800-OUT-LINE or text "OUT" to 78901
• Check circuit breaker first before reporting
• View outage map at outage.utilitycompany.com
• Life Support program for priority restoration (medical equipment)
• Planned outages communicated 48-72 hours in advance

=== GAS EMERGENCY ===
• Signs: Rotten egg smell, hissing sound, dead vegetation, bubbles in water
• Actions: Leave immediately, don't use switches or phones inside, call 911 from outside
• Emergency line: 1-800-GAS-LEAK (24/7)
• Never try to locate or repair gas leaks yourself

=== NEW SERVICE ===
• Required: Government ID, SSN or $200 deposit, service address
• Timeline: 1-2 business days, new construction 5-10 days
• Apply online, by phone (1-800-NEW-SRVC), or in person

=== SERVICE CHANGES ===
• Transfer service: 3-5 business days notice recommended
• Stop service: 3 business days for processing
• Final bill sent within 7 days of service end
• Deposits applied to final bill or refunded within 30 days

=== SMART METERS ===
• Automatic readings, no estimates
• View hourly usage online
• Set high usage alerts
• Opt-out available: $75 fee + $25/month manual read fee
• RF emissions far below FCC limits, safe to use

=== HIGH BILLS ===
• Common causes: Seasonal (AC in summer, heating in winter), rate changes, new appliances
• Free meter test available if you suspect meter issues
• Free home energy audit to identify savings
• Compare to same month last year, not last month

=== ENERGY EFFICIENCY ===
• Free LED bulb kit (up to 20 bulbs)
• Smart thermostat rebate: $50
• ENERGY STAR appliance rebates: $50-400
• Heat pump rebate: $500-800
• Free home energy audit (worth $200)
• Low-income weatherization program available

=== CONTACT INFORMATION ===
• Customer service: 1-800-UTILITY (7AM-7PM M-F, 8AM-5PM Sat)
• Outages: 1-800-OUT-LINE (24/7)
• Gas emergencies: 1-800-GAS-LEAK (24/7)
• Payment assistance: 1-800-555-HELP
• Website: www.utilitycompany.com
`;

/**
 * Default voice settings for the Retell agent
 */
export const DEFAULT_VOICE_SETTINGS = {
  voice_id: "11labs-Adrian", // Professional male voice
  voice_speed: 1.0,
  voice_temperature: 0.8,
  responsiveness: 0.9,
  interruption_sensitivity: 0.8,
  enable_backchannel: true,
  backchannel_frequency: 0.8,
  backchannel_words: ["yeah", "uh-huh", "I see", "okay", "got it"],
};

/**
 * Get the Retell client instance
 * Creates a singleton to reuse across requests
 */
export function getRetellClient(): Retell {
  if (!hasRetellConfig()) {
    throw new Error(
      "Retell is not configured. Set RETELL_API_KEY and RETELL_AGENT_ID in environment."
    );
  }

  if (!retellClient) {
    retellClient = new Retell({
      apiKey: env.RETELL_API_KEY!,
    });
  }

  return retellClient;
}

/**
 * Register a phone call with Retell
 * This creates a Retell call that can handle the conversation
 *
 * @param fromNumber - The caller's phone number
 * @param toNumber - Your Telnyx phone number
 * @param metadata - Optional metadata to pass to the agent
 * @returns The Retell call object with call_id
 */
export async function registerPhoneCall(
  fromNumber: string,
  toNumber: string,
  metadata?: Record<string, string>
): Promise<{
  call_id: string;
  agent_id: string;
}> {
  const client = getRetellClient();

  const response = await client.call.registerPhoneCall({
    agent_id: env.RETELL_AGENT_ID!,
    from_number: fromNumber,
    to_number: toNumber,
    metadata,
  });

  console.log(`📞 Retell call registered: ${response.call_id}`);

  return {
    call_id: response.call_id,
    agent_id: response.agent_id,
  };
}

/**
 * Create a web call (for browser-based calling)
 * Returns a call_id that can be used with Retell's WebRTC SDK
 *
 * @param metadata - Optional metadata to pass to the agent
 * @returns The Retell call object
 */
export async function createWebCall(
  metadata?: Record<string, string>
): Promise<{
  call_id: string;
  agent_id: string;
  access_token: string;
}> {
  const client = getRetellClient();

  const response = await client.call.createWebCall({
    agent_id: env.RETELL_AGENT_ID!,
    metadata,
  });

  console.log(`🌐 Retell web call created: ${response.call_id}`);

  return {
    call_id: response.call_id,
    agent_id: response.agent_id,
    access_token: response.access_token,
  };
}

/**
 * Get call details from Retell
 *
 * @param callId - The Retell call ID
 * @returns Call details including transcript
 */
export async function getCallDetails(callId: string): Promise<{
  call_id: string;
  agent_id: string;
  call_status: string;
  start_timestamp?: number;
  end_timestamp?: number;
  transcript?: string;
  recording_url?: string;
  disconnection_reason?: string;
}> {
  const client = getRetellClient();
  const response = await client.call.retrieve(callId);

  return {
    call_id: response.call_id,
    agent_id: response.agent_id,
    call_status: response.call_status,
    start_timestamp: response.start_timestamp,
    end_timestamp: response.end_timestamp,
    transcript: response.transcript,
    recording_url: response.recording_url,
    disconnection_reason: response.disconnection_reason,
  };
}

/**
 * End a Retell call programmatically
 *
 * @param callId - The Retell call ID to end
 */
export async function endCall(callId: string): Promise<void> {
  const client = getRetellClient();
  await client.call.delete(callId);
  console.log(`📞 Retell call ended: ${callId}`);
}

/**
 * List recent calls (useful for debugging)
 *
 * @param limit - Number of calls to retrieve (default 10)
 * @returns Array of call summaries
 */
export async function listRecentCalls(limit = 10): Promise<
  Array<{
    call_id: string;
    agent_id: string;
    call_status: string;
    start_timestamp?: number;
  }>
> {
  const client = getRetellClient();
  const response = await client.call.list({ limit });

  // Handle both array and paginated response formats
  const calls = Array.isArray(response) ? response : [];

  return calls.map((call) => ({
    call_id: call.call_id,
    agent_id: call.agent_id,
    call_status: call.call_status,
    start_timestamp: call.start_timestamp,
  }));
}

/**
 * Verify a Retell webhook signature
 * Use this to ensure webhook requests are from Retell
 *
 * @param payload - The raw request body as string
 * @param signature - The X-Retell-Signature header
 * @param apiKey - Your Retell API key
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  apiKey: string
): boolean {
  // Retell uses HMAC-SHA256 for webhook signatures
  const expectedSignature = createHmac("sha256", apiKey)
    .update(payload)
    .digest("hex");

  return signature === expectedSignature;
}

/**
 * Create a new Retell agent with utility-focused configuration
 * Use this to programmatically create an agent instead of using the dashboard
 *
 * @param llmId - The LLM ID to use (create one first with createUtilityLLM)
 * @returns The created agent details
 */
export async function createUtilityAgent(llmId: string): Promise<{
  agent_id: string;
  agent_name: string;
}> {
  const client = getRetellClient();

  const response = await client.agent.create({
    agent_name: "Utility Customer Service Agent",
    voice_id: DEFAULT_VOICE_SETTINGS.voice_id,
    voice_speed: DEFAULT_VOICE_SETTINGS.voice_speed,
    voice_temperature: DEFAULT_VOICE_SETTINGS.voice_temperature,
    responsiveness: DEFAULT_VOICE_SETTINGS.responsiveness,
    interruption_sensitivity: DEFAULT_VOICE_SETTINGS.interruption_sensitivity,
    enable_backchannel: DEFAULT_VOICE_SETTINGS.enable_backchannel,
    backchannel_frequency: DEFAULT_VOICE_SETTINGS.backchannel_frequency,
    backchannel_words: DEFAULT_VOICE_SETTINGS.backchannel_words,
    response_engine: {
      type: "retell-llm",
      llm_id: llmId,
    },
  });

  console.log(`✅ Created Retell agent: ${response.agent_id}`);
  console.log(`   Add this to your .env: RETELL_AGENT_ID=${response.agent_id}`);

  return {
    agent_id: response.agent_id,
    agent_name: response.agent_name || "Utility Customer Service Agent",
  };
}

/**
 * Get the full prompt with knowledge base for voice agent
 */
export function getFullVoiceAgentPrompt(): string {
  return `${UTILITY_VOICE_AGENT_PROMPT}

${UTILITY_KNOWLEDGE_BASE}

Remember: You are speaking on a phone call. Keep responses brief and natural. Use the knowledge base to provide accurate information, but speak it conversationally - don't read lists verbatim.`;
}

/**
 * Create a Retell LLM with utility-focused prompt and knowledge base
 * The LLM defines the agent's conversational behavior
 *
 * @returns The created LLM details
 */
export async function createUtilityLLM(): Promise<{
  llm_id: string;
}> {
  const client = getRetellClient();

  const fullPrompt = getFullVoiceAgentPrompt();
  
  console.log(`📚 Creating Retell LLM with knowledge base (${fullPrompt.length} chars)`);

  const response = await client.llm.create({
    model: "gpt-4.1-mini", // Use Retell's supported model
    general_prompt: fullPrompt,
    general_tools: [
      {
        type: "end_call",
        name: "end_call",
        description: "End the call when the conversation is complete or customer wants to hang up",
      },
    ],
    begin_message: "Hi! Thanks for calling utility customer service. How can I help you today?",
  });

  console.log(`✅ Created Retell LLM: ${response.llm_id}`);

  return {
    llm_id: response.llm_id,
  };
}

/**
 * Update an existing agent's LLM prompt with knowledge base
 * Use this to update the utility-focused prompt without recreating the agent
 *
 * @param llmId - The LLM ID to update
 */
export async function updateAgentPrompt(llmId: string): Promise<void> {
  const client = getRetellClient();
  const fullPrompt = getFullVoiceAgentPrompt();

  console.log(`📚 Updating Retell LLM with knowledge base (${fullPrompt.length} chars)`);

  await client.llm.update(llmId, {
    general_prompt: fullPrompt,
    begin_message: "Hi! Thanks for calling utility customer service. How can I help you today?",
  });

  console.log(`✅ Updated Retell LLM prompt: ${llmId}`);
}

/**
 * Get agent details including LLM configuration
 *
 * @param agentId - The agent ID (defaults to env RETELL_AGENT_ID)
 */
export async function getAgentDetails(agentId?: string): Promise<{
  agent_id: string;
  agent_name: string;
  voice_id: string;
  llm_id?: string;
}> {
  const client = getRetellClient();
  const id = agentId || env.RETELL_AGENT_ID!;
  
  const response = await client.agent.retrieve(id);

  return {
    agent_id: response.agent_id,
    agent_name: response.agent_name || "Unnamed Agent",
    voice_id: response.voice_id || "default",
    llm_id: response.response_engine?.type === "retell-llm" 
      ? response.response_engine.llm_id 
      : undefined,
  };
}

/**
 * Check if Retell is properly configured and the agent exists
 */
export async function checkRetellStatus(): Promise<{
  configured: boolean;
  agentExists: boolean;
  agentName?: string;
  error?: string;
}> {
  if (!hasRetellConfig()) {
    return {
      configured: false,
      agentExists: false,
      error: "RETELL_API_KEY or RETELL_AGENT_ID not set",
    };
  }

  try {
    const agent = await getAgentDetails();
    return {
      configured: true,
      agentExists: true,
      agentName: agent.agent_name,
    };
  } catch (error) {
    return {
      configured: true,
      agentExists: false,
      error: error instanceof Error ? error.message : "Failed to retrieve agent",
    };
  }
}

/**
 * Fetch knowledge base articles from database and format for voice agent
 * Use this to get dynamic/updated content instead of static knowledge base
 */
export async function fetchDynamicKnowledgeBase(): Promise<string> {
  try {
    const { prisma } = await import("database");
    
    const articles = await prisma.knowledgeArticle.findMany({
      select: {
        title: true,
        content: true,
        category: true,
      },
      orderBy: { category: "asc" },
    });

    if (articles.length === 0) {
      console.warn("⚠️ No knowledge base articles found, using static content");
      return UTILITY_KNOWLEDGE_BASE;
    }

    // Format articles for voice agent (simplified for speech)
    let kb = "\nKNOWLEDGE BASE - Reference information:\n\n";
    
    const categoryGroups: Record<string, typeof articles> = {};
    for (const article of articles) {
      if (!categoryGroups[article.category]) {
        categoryGroups[article.category] = [];
      }
      categoryGroups[article.category].push(article);
    }

    for (const [category, categoryArticles] of Object.entries(categoryGroups)) {
      kb += `=== ${category.replace(/_/g, " ")} ===\n`;
      for (const article of categoryArticles) {
        // Simplify content for voice (remove markdown, shorten)
        const simplifiedContent = article.content
          .replace(/\*\*/g, "") // Remove bold markers
          .replace(/\*/g, "")   // Remove italic markers
          .replace(/\n-/g, "\n•") // Convert dashes to bullets
          .substring(0, 500);   // Limit length
        
        kb += `${article.title}:\n${simplifiedContent}\n\n`;
      }
    }

    console.log(`📚 Loaded ${articles.length} knowledge base articles`);
    return kb;
  } catch (error) {
    console.error("Failed to fetch knowledge base:", error);
    return UTILITY_KNOWLEDGE_BASE;
  }
}

/**
 * Create or update Retell LLM with dynamic knowledge base from database
 */
export async function createUtilityLLMWithDynamicKB(): Promise<{
  llm_id: string;
}> {
  const client = getRetellClient();
  const dynamicKB = await fetchDynamicKnowledgeBase();
  
  const fullPrompt = `${UTILITY_VOICE_AGENT_PROMPT}

${dynamicKB}

Remember: You are speaking on a phone call. Keep responses brief and natural. Use the knowledge base to provide accurate information, but speak it conversationally - don't read lists verbatim.`;

  console.log(`📚 Creating Retell LLM with dynamic KB (${fullPrompt.length} chars)`);

  const response = await client.llm.create({
    model: "gpt-4.1-mini",
    general_prompt: fullPrompt,
    general_tools: [
      {
        type: "end_call",
        name: "end_call",
        description: "End the call when the conversation is complete or customer wants to hang up",
      },
    ],
    begin_message: "Hi! Thanks for calling utility customer service. How can I help you today?",
  });

  console.log(`✅ Created Retell LLM with dynamic KB: ${response.llm_id}`);

  return {
    llm_id: response.llm_id,
  };
}

// ===========================================
// Chat Agent Integration
// ===========================================

/**
 * Chat session state mapping (our sessionId -> Retell chat_id)
 */
const chatSessionMap = new Map<string, string>();

/**
 * Create a new Retell chat session
 * 
 * @param ourSessionId - Our internal session ID
 * @param metadata - Optional metadata for the chat
 * @returns The Retell chat_id
 */
export async function createChatSession(
  ourSessionId: string,
  metadata?: Record<string, unknown>
): Promise<{
  chat_id: string;
  agent_id: string;
}> {
  if (!hasRetellChatConfig()) {
    throw new Error("Retell Chat is not configured. Set RETELL_CHAT_AGENT_ID in environment.");
  }

  const client = getRetellClient();

  const response = await client.chat.create({
    agent_id: env.RETELL_CHAT_AGENT_ID!,
    metadata: {
      internal_session_id: ourSessionId,
      ...metadata,
    },
  });

  console.log(`💬 Retell chat session created: ${response.chat_id} for ${ourSessionId}`);

  // Store mapping
  chatSessionMap.set(ourSessionId, response.chat_id);

  return {
    chat_id: response.chat_id,
    agent_id: response.agent_id,
  };
}

/**
 * Get or create a Retell chat session for our internal session ID
 */
export async function getOrCreateChatSession(
  ourSessionId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  // Check if we already have a mapping
  let chatId = chatSessionMap.get(ourSessionId);
  
  if (!chatId) {
    const result = await createChatSession(ourSessionId, metadata);
    chatId = result.chat_id;
  }

  return chatId;
}

/**
 * Send a message to the Retell chat and get a response
 * 
 * @param ourSessionId - Our internal session ID
 * @param message - The user's message
 * @returns The AI's response message(s)
 */
export async function sendChatMessage(
  ourSessionId: string,
  message: string
): Promise<{
  response: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
}> {
  if (!hasRetellChatConfig()) {
    throw new Error("Retell Chat is not configured.");
  }

  // Get or create the chat session
  const chatId = await getOrCreateChatSession(ourSessionId);
  const client = getRetellClient();

  console.log(`💬 Sending message to Retell chat ${chatId}: "${message.substring(0, 50)}..."`);

  const response = await client.chat.createChatCompletion({
    chat_id: chatId,
    content: message,
  });

  // Extract agent messages from the response
  const agentMessages: Array<{ role: string; content: string; timestamp: number }> = [];
  let fullResponse = "";

  for (const msg of response.messages) {
    if ("role" in msg && msg.role === "agent" && "content" in msg) {
      agentMessages.push({
        role: "agent",
        content: msg.content,
        timestamp: msg.created_timestamp,
      });
      fullResponse += (fullResponse ? "\n" : "") + msg.content;
    }
  }

  console.log(`✅ Retell chat response: "${fullResponse.substring(0, 100)}..."`);

  return {
    response: fullResponse || "I'm here to help! What can I assist you with?",
    messages: agentMessages,
  };
}

/**
 * Get chat session details including full transcript
 */
export async function getChatDetails(ourSessionId: string): Promise<{
  chat_id: string;
  status: string;
  transcript?: string;
  messages?: Array<{ role: string; content: string; timestamp: number }>;
}> {
  const chatId = chatSessionMap.get(ourSessionId);
  
  if (!chatId) {
    throw new Error(`No chat session found for ${ourSessionId}`);
  }

  const client = getRetellClient();
  const response = await client.chat.retrieve(chatId);

  const messages: Array<{ role: string; content: string; timestamp: number }> = [];
  
  if (response.message_with_tool_calls) {
    for (const msg of response.message_with_tool_calls) {
      if ("role" in msg && (msg.role === "agent" || msg.role === "user") && "content" in msg) {
        messages.push({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_timestamp,
        });
      }
    }
  }

  return {
    chat_id: response.chat_id,
    status: response.chat_status,
    transcript: response.transcript,
    messages,
  };
}

/**
 * End a Retell chat session
 */
export async function endChatSession(ourSessionId: string): Promise<void> {
  const chatId = chatSessionMap.get(ourSessionId);
  
  if (!chatId) {
    console.warn(`No chat session found for ${ourSessionId} to end`);
    return;
  }

  try {
    const client = getRetellClient();
    await client.chat.end(chatId);
    console.log(`💬 Retell chat session ended: ${chatId}`);
  } catch (error) {
    console.error(`Failed to end chat session:`, error);
  }

  // Clean up mapping
  chatSessionMap.delete(ourSessionId);
}

/**
 * Create a Retell chat agent (for setup)
 * This creates a chat agent using the same LLM as the voice agent
 */
export async function createChatAgent(llmId: string): Promise<{
  agent_id: string;
  agent_name: string;
}> {
  const client = getRetellClient();

  const response = await client.chatAgent.create({
    agent_name: "Utility Customer Service Chat Agent",
    response_engine: {
      type: "retell-llm",
      llm_id: llmId,
    },
    language: "en-US",
  });

  console.log(`✅ Created Retell chat agent: ${response.agent_id}`);
  console.log(`   Add this to your .env: RETELL_CHAT_AGENT_ID=${response.agent_id}`);

  return {
    agent_id: response.agent_id,
    agent_name: response.agent_name || "Utility Customer Service Chat Agent",
  };
}

/**
 * Check if Retell chat is configured
 */
export function isChatConfigured(): boolean {
  return hasRetellChatConfig();
}

// Re-export config checks
export { hasRetellConfig, hasRetellChatConfig };
