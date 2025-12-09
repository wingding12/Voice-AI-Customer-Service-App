/**
 * Chat Service
 *
 * Handles text chat messages with unified processing:
 * - AI responses via simple LLM (or Retell web call)
 * - Human takeover support
 * - Same copilot suggestions as voice
 */

import { prisma } from "database";
import { v4 as uuidv4 } from "uuid";
import {
  createSession,
  getSession,
  updateSession,
  appendTranscript,
} from "../state/sessionStore.js";
import {
  emitTranscriptUpdate,
  emitCallStateUpdate,
  emitCopilotSuggestion,
} from "../../sockets/agentGateway.js";
import { processTranscript } from "../copilot/copilotService.js";
import { smartSearch } from "../copilot/ragService.js";
import type { CallSession, ChatRequest, ChatResponse, TranscriptEntry } from "shared-types";

/**
 * Chat session (reuses CallSession structure for consistency)
 */
export interface ChatSessionData {
  sessionId: string;
  mode: "AI_AGENT" | "HUMAN_REP";
  transcript: TranscriptEntry[];
  customerId?: string;
}

/**
 * Process an incoming chat message
 *
 * @param request - Chat request with message and optional sessionId
 * @returns Chat response with AI reply and sessionId
 */
export async function processMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const { message, sessionId: existingSessionId } = request;

  // Get or create session
  let sessionId = existingSessionId || `chat-${uuidv4()}`;
  let session = await getSession(sessionId);

  if (!session) {
    // Create new chat session
    session = {
      callId: sessionId,
      customerId: null,
      mode: "AI_AGENT",
      status: "active",
      startTime: Date.now(),
      transcript: [],
      switchCount: 0,
      metadata: {
        channel: "chat",
      },
    };
    await createSession(sessionId, session);

    // Create database record
    try {
      await prisma.call.create({
        data: {
          id: sessionId,
          mode: "AI_AGENT",
          status: "ACTIVE",
          startedAt: new Date(),
          transcript: [],
        },
      });
    } catch (error) {
      console.error("Failed to create chat record:", error);
    }
  }

  // Add customer message to transcript
  const timestamp = Date.now();
  await appendTranscript(sessionId, "CUSTOMER", message, timestamp);

  // Emit to frontend (for agent dashboard to see)
  emitTranscriptUpdate(sessionId, {
    speaker: "CUSTOMER",
    text: message,
    timestamp,
  });

  // Generate response based on mode
  let reply: string;

  if (session.mode === "AI_AGENT") {
    // AI mode: generate response
    reply = await generateAIResponse(sessionId, message, session.transcript);

    // Add AI response to transcript
    const aiTimestamp = Date.now();
    await appendTranscript(sessionId, "AI", reply, aiTimestamp);

    // Emit AI response
    emitTranscriptUpdate(sessionId, {
      speaker: "AI",
      text: reply,
      timestamp: aiTimestamp,
    });
  } else {
    // Human mode: queue for human rep
    reply = "A human representative will respond shortly. Please wait.";

    // Notify agent dashboard that there's a message waiting
    emitCallStateUpdate(sessionId, {
      callId: sessionId,
      activeSpeaker: "CUSTOMER",
      isMuted: false,
      mode: "HUMAN_REP",
    });
  }

  // Trigger copilot analysis (async, don't block response)
  const updatedSession = await getSession(sessionId);
  if (updatedSession && updatedSession.transcript.length >= 2) {
    processTranscript(sessionId, updatedSession.transcript).catch((err) => {
      console.error("❌ Copilot processing error:", err);
    });
  }

  // Get suggestions for response
  const suggestions = await getCopilotSuggestions(message);

  return {
    reply,
    sessionId,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Generate AI response to customer message
 */
async function generateAIResponse(
  sessionId: string,
  message: string,
  transcript: TranscriptEntry[]
): Promise<string> {
  // Check for switch commands
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("/human") ||
    lowerMessage.includes("speak to agent") ||
    lowerMessage.includes("talk to human") ||
    lowerMessage.includes("real person")
  ) {
    // Switch to human mode
    await updateSession(sessionId, { mode: "HUMAN_REP" });
    try {
      await prisma.call.update({
        where: { id: sessionId },
        data: { mode: "HUMAN_REP" },
      });
      await prisma.switchLog.create({
        data: {
          callId: sessionId,
          direction: "AI_TO_HUMAN",
          reason: "CHAT_COMMAND",
        },
      });
    } catch (error) {
      console.error("Failed to log chat switch:", error);
    }

    emitCallStateUpdate(sessionId, {
      callId: sessionId,
      activeSpeaker: "HUMAN",
      isMuted: false,
      mode: "HUMAN_REP",
    });

    return "I'm connecting you with a human representative. They'll be with you shortly.";
  }

  // Search knowledge base for relevant info
  const articles = await smartSearch(message, 2);

  // Generate contextual response
  if (articles.length > 0) {
    const topArticle = articles[0];

    // Simple response based on knowledge base
    if (topArticle.similarity > 0.7) {
      return `Based on our ${topArticle.category.toLowerCase()} information:\n\n${topArticle.content}\n\nIs there anything else I can help you with?`;
    }
  }

  // Default responses based on keywords
  if (lowerMessage.includes("order") || lowerMessage.includes("tracking")) {
    return "I'd be happy to help with your order. Could you please provide your order number? You can find it in your confirmation email.";
  }

  if (lowerMessage.includes("refund") || lowerMessage.includes("return")) {
    return "I can help you with returns and refunds. Our return policy allows returns within 30 days of purchase. Would you like me to start a return for you?";
  }

  if (lowerMessage.includes("help") || lowerMessage.includes("support")) {
    return "I'm here to help! I can assist with:\n• Order status and tracking\n• Returns and refunds\n• Product information\n• Account questions\n\nWhat would you like help with?";
  }

  // Generic helpful response
  return "Thank you for your message. I'm here to help with orders, returns, product questions, and more. How can I assist you today?";
}

/**
 * Get copilot suggestions for a message
 */
async function getCopilotSuggestions(message: string) {
  const articles = await smartSearch(message, 2);

  return articles.map((article) => ({
    type: "INFO" as const,
    title: article.title,
    content: article.content.substring(0, 200) + "...",
    confidenceScore: article.similarity,
    metadata: {
      articleId: article.id,
      category: article.category,
    },
  }));
}

/**
 * Send a message from human rep to customer
 */
export async function sendHumanResponse(
  sessionId: string,
  message: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  if (session.mode !== "HUMAN_REP") {
    throw new Error("Session is not in human mode");
  }

  const timestamp = Date.now();
  await appendTranscript(sessionId, "HUMAN", message, timestamp);

  emitTranscriptUpdate(sessionId, {
    speaker: "HUMAN",
    text: message,
    timestamp,
  });
}

/**
 * End a chat session
 */
export async function endChatSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);

  // Update database
  try {
    await prisma.call.update({
      where: { id: sessionId },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        transcript: session?.transcript
          ? JSON.parse(JSON.stringify(session.transcript))
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to end chat session:", error);
  }

  // Update session status
  if (session) {
    await updateSession(sessionId, { status: "ended" });
  }
}

