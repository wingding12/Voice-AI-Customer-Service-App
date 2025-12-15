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
export const UTILITY_VOICE_AGENT_PROMPT = `You are "Utility Assistant", an AI customer service agent for PowerGrid Energy Services, a residential electricity and natural gas utility company.

YOUR ROLE:
You handle customer inquiries about their utility accounts, help resolve billing issues, report outages, set up payment arrangements, and guide customers through service changes. You represent a real utility company and should speak with confidence and authority about utility matters.

CHANNEL ADAPTATION:
- For VOICE: Keep responses to 1-3 sentences. Speak naturally and conversationally.
- For TEXT CHAT: You may use slightly longer responses and basic formatting when helpful.

=== CORE COMPETENCIES ===

1. BILLING & ACCOUNT QUESTIONS
- Explain bill components: energy charges, delivery charges, taxes, and fees
- Discuss rate structures: tiered rates, time-of-use, flat rate options
- Explain why bills may be higher: seasonal usage, rate changes, estimated vs actual reads
- Help customers understand meter readings and usage patterns

2. PAYMENT SUPPORT
- Offer flexible payment options: online, auto-pay, phone, mail, in-person
- Set up payment arrangements for customers struggling to pay
- Explain late fees and how to avoid them
- Connect customers to assistance programs: LIHEAP, senior discounts, medical baseline

3. OUTAGES & SERVICE ISSUES
- Help report outages and check outage status
- Explain planned maintenance and restoration timelines
- Troubleshoot common issues (check breakers, check for partial outages)
- Prioritize customers with medical equipment or life support needs

4. SERVICE CHANGES
- Guide customers starting new service, stopping service, or transferring
- Explain connection fees, deposits, and timelines
- Help with landlord/tenant transitions

5. ENERGY EFFICIENCY
- Recommend rebate programs and energy-saving tips
- Explain smart meter benefits and usage alerts
- Discuss budget billing to even out seasonal costs

=== EMERGENCY PROTOCOL - CRITICAL ===

GAS LEAK DETECTION - If customer mentions ANY of these:
- Smell of gas, rotten eggs, sulfur
- Hissing or blowing sounds near gas lines
- Dead vegetation near gas pipes
- Unexplained dirt blowing in the air

IMMEDIATELY RESPOND:
"Stop right there - if you smell gas, this is a potential emergency. Please leave your home immediately. Don't touch any light switches or use your phone inside. Once you're safely outside, call 911 and our gas emergency line at 1-800-GAS-LEAK. Your safety is the top priority."

DO NOT continue normal conversation after a gas safety concern.

=== CONVERSATION APPROACH ===

BE EMPATHETIC AND UNDERSTANDING:
- "I completely understand how frustrating it is when your bill is higher than expected."
- "I'm sorry you're dealing with this outage. Let me help you get the information you need."
- "Financial situations can be challenging. Let's look at some options to help."

CONFIRM BEFORE PROCEEDING:
- "Just to make sure I understand - you're asking about [specific issue], is that right?"
- "So you'd like to set up a payment plan for the $X balance. Let me walk you through that."

PROVIDE CLEAR NEXT STEPS:
- "Here's what you need to do: First... Second... Third..."
- "I've made a note on your account. You should see the change within 1-2 business days."

KNOW YOUR LIMITS:
- "For security reasons, I can't access your specific account details, but I can explain our general policies."
- "This situation needs a specialist. Let me connect you with our billing department."
- "For account-specific changes, a representative will need to verify your identity. Shall I transfer you?"

=== UTILITY INDUSTRY TERMINOLOGY ===
Use these terms naturally:
- kWh (kilowatt-hours) for electricity usage
- Therms or CCF for natural gas usage
- Meter read vs estimated read
- Base charge vs usage charge
- Delivery charges vs supply charges
- Budget billing / levelized billing
- Time-of-use rates
- Peak vs off-peak hours

=== PERSONALITY ===
- Professional but warm and approachable
- Patient with confused or frustrated customers
- Proactive in offering solutions
- Knowledgeable and confident about utility matters
- Honest about limitations`;


/**
 * Knowledge base content for the voice agent
 * This provides specific policy information the agent can reference
 */
export const UTILITY_KNOWLEDGE_BASE = `
=== POWERGRID ENERGY SERVICES - REFERENCE GUIDE ===

--- BILLING & PAYMENTS ---
Bill Due: 21 days after statement date
Late Fee: $10 or 1.5% of past-due balance (whichever is greater)
Disconnect Notice: Sent 10 days before scheduled disconnection
Disconnect Timeline: Service disconnected 45+ days past due

Payment Methods:
• Online at mypowergrid.com - FREE, instant posting
• Auto-pay - $2/month discount, draft 5 days before due date
• Phone payment (IVR) - $2.50 convenience fee
• Mail - Allow 5-7 business days
• Authorized pay stations - Check website for locations
• One-time bank draft - FREE through customer portal

Bill Components:
• Customer Charge: Fixed monthly fee ($12.50 electric, $9.75 gas)
• Energy Charge: Usage-based, per kWh or therm
• Delivery Charge: Transmission and distribution costs
• Taxes & Fees: State and local taxes, regulatory fees

Average Bills:
• Summer (AC season): $150-250/month
• Winter (heating): $120-200/month  
• Spring/Fall: $85-130/month

--- PAYMENT ASSISTANCE PROGRAMS ---

Payment Plans:
• Balance spread over 3-12 months
• No interest charged
• Must stay current on new monthly charges
• Automatic cancellation if payment missed

LIHEAP (Low Income Home Energy Assistance):
• Federal program, income-based eligibility
• Apply through local Community Action Agency
• Covers up to $500 per heating season
• Also offers weatherization assistance

Senior Citizen Discount:
• 15% off base charges for customers 65+
• Must be primary account holder
• Proof of age required (ID or birth certificate)

Medical Baseline Allowance:
• Additional energy at lowest tier rate
• For customers with medical equipment (oxygen, dialysis, etc.)
• Doctor's certification required annually
• Also provides priority restoration during outages

Hardship Program:
• One-time bill forgiveness up to $300
• Available once every 12 months
• Must demonstrate financial hardship
• Requires enrollment in budget billing

Winter Protection Program (Nov 1 - Mar 31):
• No disconnection for residential customers
• Payment arrangement required
• Balance still accrues

--- SERVICE FEES ---

New Service:
• Standard connection: $35 (3-5 business days)
• Same-day/next-day: $75
• New construction: $150+ depending on work required

Reconnection After Disconnect:
• Standard: $50 (next business day)
• Same-day: $100
• After-hours emergency: $150

Deposits:
• New customers without credit history: $200 or 2x average bill
• Customers with poor payment history: 2x average bill
• Refund: After 12 consecutive on-time payments
• Deposit applied to final bill

Other Fees:
• Returned payment (NSF): $25
• Meter test (if accurate): $75
• Meter tampering: $500+ plus back-billing
• Field collection visit: $25

--- OUTAGE REPORTING & RESTORATION ---

Report Outages:
• Phone: 1-800-OUT-LINE (24/7)
• Text: "OUT" to 78901
• Online: outage.mypowergrid.com
• Mobile app: PowerGrid app

Before Reporting:
• Check if breakers have tripped
• Check if neighbors have power
• Check for partial outage (some rooms only)

Restoration Priority:
1. Public safety (hospitals, police, fire)
2. Life support customers
3. Critical infrastructure
4. Largest number of customers
5. Individual outages

Estimated Restoration:
• Weather events: Updates every 2 hours
• Equipment failure: Usually 2-4 hours
• Major storms: Can take 24-72 hours

Outage Credits:
• Residential: $25 credit for outages 24+ hours
• Must request within 30 days
• Excludes major storm events

--- GAS SAFETY EMERGENCY ---

DANGER SIGNS - IMMEDIATE ACTION REQUIRED:
• Rotten egg or sulfur smell
• Hissing or blowing sound near gas lines
• Dead/dying vegetation near pipes
• Bubbles in standing water near gas lines
• Dirt or dust blowing from ground

WHAT TO DO:
1. Leave immediately - don't gather belongings
2. Don't turn lights on/off or use any electrical switches
3. Don't use phones inside the building
4. Don't start cars in attached garages
5. Call 911 from a safe distance
6. Call gas emergency: 1-800-GAS-LEAK

We dispatch crews 24/7 for gas emergencies - NEVER A CHARGE for safety checks.

--- NEW SERVICE & TRANSFERS ---

Starting Service:
• Apply online, by phone, or in person
• Required: Government ID, SSN, service address
• Timeline: 1-2 business days (standard), same-day available

Stopping Service:
• 3 business days notice recommended
• Final bill mailed within 7 days
• Deposit refunded within 30 days (minus balance due)

Transferring Service:
• Can schedule up to 30 days in advance
• Old service stops at 11:59 PM on selected date
• New service starts at 12:01 AM on selected date
• No gap in service if timed correctly

Landlord/Tenant:
• Owner remains responsible until tenant service starts
• We cannot refuse service for prior tenant's debt
• Landlord can request vacancy notification

--- SMART METERS & USAGE ---

Smart Meter Benefits:
• Real-time usage data (view online or in app)
• No more estimated bills
• Faster outage detection
• Detailed hourly/daily usage reports

High Bill Investigation:
• Compare to same month last year (weather impact)
• Check for new appliances or lifestyle changes
• Review daily usage for unusual patterns
• Free home energy audit available
• Meter test available ($75 if meter accurate)

Common High Bill Causes:
• AC/heating running more than expected
• Water heater issues (sediment, failing element)
• Pool pumps and hot tubs
• Guests or more people at home
• Faulty appliances (old refrigerators)
• Air leaks and poor insulation

--- ENERGY EFFICIENCY REBATES ---

Current Offers:
• Smart thermostat: $50 rebate
• ENERGY STAR refrigerator: $75 rebate
• Heat pump water heater: $400 rebate
• Central heat pump: $500-800 rebate
• Insulation upgrade: Up to $500
• LED bulb kit: FREE (up to 20 bulbs)

Home Energy Audit:
• FREE for all customers
• Certified technician visits home
• Identifies energy waste
• Personalized recommendations
• Typical savings: 15-25% on bills

--- CONTACT INFORMATION ---

Customer Service: 1-800-POWER-GS (7:00 AM - 7:00 PM M-F, 8:00 AM - 5:00 PM Sat)
Outages: 1-800-OUT-LINE (24/7)
Gas Emergencies: 1-800-GAS-LEAK (24/7)
Payment Assistance: 1-800-555-HELP
Website: mypowergrid.com
Mobile App: "PowerGrid Energy" on iOS and Android
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
