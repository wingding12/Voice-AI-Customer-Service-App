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
import { env, hasRetellConfig } from "../../config/env.js";

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

KEY POLICIES (mention only when relevant):
- Bills due 21 days after statement
- Payment options: online free, auto-pay saves two dollars monthly, phone has a fee
- New service: thirty-five dollars standard, seventy-five same-day
- Payment plans available three to twelve months

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
 * Create a Retell LLM with utility-focused prompt
 * The LLM defines the agent's conversational behavior
 *
 * @returns The created LLM details
 */
export async function createUtilityLLM(): Promise<{
  llm_id: string;
}> {
  const client = getRetellClient();

  const response = await client.llm.create({
    model: "gpt-4.1-mini", // Use Retell's supported model
    general_prompt: UTILITY_VOICE_AGENT_PROMPT,
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
 * Update an existing agent's LLM prompt
 * Use this to update the utility-focused prompt without recreating the agent
 *
 * @param llmId - The LLM ID to update
 */
export async function updateAgentPrompt(llmId: string): Promise<void> {
  const client = getRetellClient();

  await client.llm.update(llmId, {
    general_prompt: UTILITY_VOICE_AGENT_PROMPT,
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

// Re-export config check
export { hasRetellConfig };
