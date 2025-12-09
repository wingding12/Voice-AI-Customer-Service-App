/**
 * AssemblyAI Client for Copilot Analysis
 *
 * Uses AssemblyAI's LeMUR for:
 * - Intent detection from transcripts
 * - Entity extraction (order numbers, customer info)
 * - Sentiment analysis
 * - Conversation summarization
 */

import { AssemblyAI } from "assemblyai";
import { env, hasAssemblyAIConfig } from "../../config/env.js";

// Singleton AssemblyAI client
let assemblyClient: AssemblyAI | null = null;

/**
 * Get the AssemblyAI client instance
 */
export function getAssemblyClient(): AssemblyAI {
  if (!hasAssemblyAIConfig()) {
    throw new Error(
      "AssemblyAI is not configured. Set ASSEMBLYAI_API_KEY in environment."
    );
  }

  if (!assemblyClient) {
    assemblyClient = new AssemblyAI({
      apiKey: env.ASSEMBLYAI_API_KEY!,
    });
  }

  return assemblyClient;
}

/**
 * Detected intent from conversation
 */
export interface DetectedIntent {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
  suggestedAction?: string;
}

/**
 * Analyze transcript to detect customer intent
 *
 * @param transcript - Array of conversation entries
 * @returns Detected intent with entities
 */
export async function detectIntent(
  transcript: Array<{ speaker: string; text: string }>
): Promise<DetectedIntent> {
  const client = getAssemblyClient();

  // Format transcript for LeMUR
  const formattedTranscript = transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join("\n");

  const prompt = `Analyze this customer service conversation and extract:
1. The customer's primary intent (e.g., "order_status", "refund_request", "product_question", "complaint", "general_inquiry")
2. Any specific entities mentioned (order numbers, product names, dates, amounts)
3. A suggested action for the representative

Conversation:
${formattedTranscript}

Respond in JSON format:
{
  "intent": "the_primary_intent",
  "confidence": 0.0 to 1.0,
  "entities": {
    "order_id": "if mentioned",
    "product": "if mentioned",
    "amount": "if mentioned"
  },
  "suggestedAction": "what the rep should do next"
}`;

  try {
    const response = await client.lemur.task({
      prompt,
      final_model: "anthropic/claude-3-haiku",
    });

    // Parse JSON from response
    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        intent: parsed.intent || "unknown",
        confidence: parsed.confidence || 0.5,
        entities: parsed.entities || {},
        suggestedAction: parsed.suggestedAction,
      };
    }

    return {
      intent: "unknown",
      confidence: 0,
      entities: {},
    };
  } catch (error) {
    console.error("❌ AssemblyAI intent detection error:", error);
    return {
      intent: "error",
      confidence: 0,
      entities: {},
    };
  }
}

/**
 * Analyze sentiment of the conversation
 *
 * @param transcript - Array of conversation entries
 * @returns Sentiment analysis result
 */
export async function analyzeSentiment(
  transcript: Array<{ speaker: string; text: string }>
): Promise<{
  overall: "positive" | "neutral" | "negative";
  score: number;
  customerFrustration: boolean;
}> {
  const client = getAssemblyClient();

  const formattedTranscript = transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join("\n");

  const prompt = `Analyze the sentiment of this customer service conversation.
Focus on the customer's emotional state.

Conversation:
${formattedTranscript}

Respond in JSON format:
{
  "overall": "positive" | "neutral" | "negative",
  "score": -1.0 to 1.0 (negative to positive),
  "customerFrustration": true/false
}`;

  try {
    const response = await client.lemur.task({
      prompt,
      final_model: "anthropic/claude-3-haiku",
    });

    const jsonMatch = response.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overall: parsed.overall || "neutral",
        score: parsed.score || 0,
        customerFrustration: parsed.customerFrustration || false,
      };
    }

    return { overall: "neutral", score: 0, customerFrustration: false };
  } catch (error) {
    console.error("❌ AssemblyAI sentiment analysis error:", error);
    return { overall: "neutral", score: 0, customerFrustration: false };
  }
}

/**
 * Generate a conversation summary
 *
 * @param transcript - Array of conversation entries
 * @returns Summary of the conversation
 */
export async function summarizeConversation(
  transcript: Array<{ speaker: string; text: string }>
): Promise<string> {
  const client = getAssemblyClient();

  const formattedTranscript = transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join("\n");

  const prompt = `Summarize this customer service conversation in 2-3 sentences.
Focus on the customer's issue and any resolution provided.

Conversation:
${formattedTranscript}`;

  try {
    const response = await client.lemur.task({
      prompt,
      final_model: "anthropic/claude-3-haiku",
    });

    return response.response.trim();
  } catch (error) {
    console.error("❌ AssemblyAI summarization error:", error);
    return "Unable to generate summary.";
  }
}

/**
 * Extract action items from conversation
 *
 * @param transcript - Array of conversation entries
 * @returns List of action items
 */
export async function extractActionItems(
  transcript: Array<{ speaker: string; text: string }>
): Promise<string[]> {
  const client = getAssemblyClient();

  const formattedTranscript = transcript
    .map((entry) => `${entry.speaker}: ${entry.text}`)
    .join("\n");

  const prompt = `Extract any action items or follow-ups mentioned in this customer service conversation.

Conversation:
${formattedTranscript}

Respond with a JSON array of action items:
["action item 1", "action item 2"]`;

  try {
    const response = await client.lemur.task({
      prompt,
      final_model: "anthropic/claude-3-haiku",
    });

    const jsonMatch = response.response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return [];
  } catch (error) {
    console.error("❌ AssemblyAI action extraction error:", error);
    return [];
  }
}

// Re-export config check
export { hasAssemblyAIConfig };

