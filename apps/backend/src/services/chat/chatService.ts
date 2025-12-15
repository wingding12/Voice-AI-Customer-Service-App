/**
 * Chat Service - Utility Company Edition
 *
 * Handles text chat messages for utility customer service:
 * - Uses Gemini AI for chat responses with utility-specialized prompt
 * - Same knowledge base and personality as voice agent
 * - Supports seamless AI-to-Human handoff
 * - Copilot integration for human reps
 * - Real-time updates via Socket.io
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
  emitQueueAdd,
  emitQueueUpdate,
  emitQueueMessagePreview,
  emitCopilotSuggestion,
} from "../../sockets/agentGateway.js";
import { 
  generateAgentResponse, 
  generateCopilotAnalysis, 
  clearContext,
  isLLMAvailable,
} from "../ai/llmService.js";
import type { CallSession, ChatRequest, ChatResponse, TranscriptEntry } from "shared-types";

/**
 * Chat session interface
 */
export interface ChatSessionData {
  sessionId: string;
  mode: "AI_AGENT" | "HUMAN_REP";
  transcript: TranscriptEntry[];
  customerId?: string;
}

/**
 * Process an incoming chat message
 */
export async function processMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const { message, sessionId: existingSessionId } = request;

  // Get or create session
  let sessionId = existingSessionId || `chat-${uuidv4()}`;
  let session = await getSession(sessionId);

  if (!session) {
    const startTime = Date.now();
    session = {
      callId: sessionId,
      customerId: null,
      mode: "AI_AGENT",
      status: "active",
      startTime,
      transcript: [],
      switchCount: 0,
      metadata: {
        channel: "chat",
        serviceType: "utility",
      },
    };
    await createSession(sessionId, session);

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

    // Notify agents about new chat in queue
    emitQueueAdd({
      id: sessionId,
      type: "chat",
      customerName: "Customer",
      waitTime: 0,
      preview: message.substring(0, 50),
      mode: "AI_AGENT",
      createdAt: startTime,
    });
  }

  // Add customer message to transcript
  const timestamp = Date.now();
  await appendTranscript(sessionId, "CUSTOMER", message, timestamp);

  emitTranscriptUpdate(sessionId, {
    speaker: "CUSTOMER",
    text: message,
    timestamp,
  });

  // Update queue preview with latest customer message
  emitQueueMessagePreview(sessionId, `Customer: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

  // Get updated session with new message
  const updatedSession = await getSession(sessionId);
  const transcript = updatedSession?.transcript || [];

  // Generate response based on mode
  let reply: string;

  if (session.mode === "AI_AGENT") {
    // Use Gemini AI for chat responses with utility-specialized prompt
    if (isLLMAvailable()) {
      try {
        const aiResponse = await generateAgentResponse(sessionId, transcript);
        reply = aiResponse.message;
        
        console.log(`🤖 Gemini chat response for ${sessionId}: ${reply.substring(0, 100)}...`);
        
        // Check for AI-suggested escalation
        if (aiResponse.shouldEscalate) {
          await switchToHuman(sessionId, aiResponse.escalationReason || "AI_ESCALATION");
        }
      } catch (error) {
        console.error("Gemini chat error:", error);
        reply = "I'm sorry, I'm having trouble processing your request. Please try again or ask to speak with a representative.";
      }
    } else {
      // Fallback if Gemini is not configured
      reply = "Hello! I'm your utility assistant. How can I help you today? (Note: Gemini API key is not configured)";
    }

    // Add AI response to transcript
    const aiTimestamp = Date.now();
    await appendTranscript(sessionId, "AI", reply, aiTimestamp);

    emitTranscriptUpdate(sessionId, {
      speaker: "AI",
      text: reply,
      timestamp: aiTimestamp,
    });

    // Update queue preview
    emitQueueMessagePreview(sessionId, `AI: ${reply.substring(0, 50)}${reply.length > 50 ? '...' : ''}`);
  } else {
    // Human mode - notify the customer that rep will respond
    // Don't send a scripted message, just update state
    reply = ""; // No auto-reply in human mode

    emitCallStateUpdate(sessionId, {
      callId: sessionId,
      activeSpeaker: "CUSTOMER",
      isMuted: false,
      mode: "HUMAN_REP",
    });
  }

  // Generate and emit copilot analysis for the agent
  try {
    const copilotAnalysis = await generateCopilotAnalysis(sessionId, transcript);
    
    // Emit each suggestion
    for (const suggestion of copilotAnalysis.suggestions) {
      emitCopilotSuggestion(sessionId, suggestion);
    }
  } catch (error) {
    console.error("Copilot analysis error:", error);
  }

  return {
    reply,
    sessionId,
  };
}

/**
 * Switch to AI agent (called when customer wants to return to AI)
 */
export async function switchBackToAI(sessionId: string): Promise<string> {
  await updateSession(sessionId, { mode: "AI_AGENT" });
  try {
    await prisma.call.update({
      where: { id: sessionId },
      data: { mode: "AI_AGENT" },
    });
    await prisma.switchLog.create({
      data: {
        callId: sessionId,
        direction: "HUMAN_TO_AI",
        reason: "CUSTOMER_REQUEST",
      },
    });
  } catch (error) {
    console.error("Failed to log switch back to AI:", error);
  }

  emitCallStateUpdate(sessionId, {
    callId: sessionId,
    activeSpeaker: "AI",
    isMuted: false,
    mode: "AI_AGENT",
  });

  // Update queue
  emitQueueUpdate({
    id: sessionId,
    mode: "AI_AGENT",
    preview: "Returned to AI assistant",
  });

  // Generate welcome back message using Gemini
  let aiMessage: string;
  
  if (isLLMAvailable()) {
    try {
      // Add a system note to the transcript context for Gemini
      const session = await getSession(sessionId);
      const transcript = session?.transcript || [];
      transcript.push({
        speaker: "CUSTOMER",
        text: "[Customer has switched back to the AI assistant from a human representative]",
        timestamp: Date.now() - 100,
      });
      
      const aiResponse = await generateAgentResponse(sessionId, transcript);
      aiMessage = aiResponse.message;
    } catch (error) {
      console.error("Gemini error on switch back:", error);
      aiMessage = "I'm back! How else can I help you with your utility needs?";
    }
  } else {
    aiMessage = "I'm back! How can I continue to help you?";
  }
  
  const timestamp = Date.now();
  await appendTranscript(sessionId, "AI", aiMessage, timestamp);

  emitTranscriptUpdate(sessionId, {
    speaker: "AI",
    text: aiMessage,
    timestamp,
  });

  return aiMessage;
}

/**
 * Switch to human representative
 */
async function switchToHuman(sessionId: string, reason: string = "CHAT_COMMAND"): Promise<void> {
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
        reason,
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

  // Update queue to show this needs human attention
  emitQueueUpdate({
    id: sessionId,
    mode: "HUMAN_REP",
    preview: reason === "GAS_EMERGENCY" ? "⚠️ GAS EMERGENCY" : "Needs human response",
  });
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

  // Update queue preview
  emitQueueMessagePreview(sessionId, `Agent: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

  // Regenerate copilot suggestions based on new context
  try {
    const transcript = session.transcript || [];
    transcript.push({ speaker: "HUMAN", text: message, timestamp });
    
    const copilotAnalysis = await generateCopilotAnalysis(sessionId, transcript);
    for (const suggestion of copilotAnalysis.suggestions) {
      emitCopilotSuggestion(sessionId, suggestion);
    }
  } catch (error) {
    console.error("Copilot analysis error:", error);
  }
}

/**
 * End a chat session
 */
export async function endChatSession(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);

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

  if (session) {
    await updateSession(sessionId, { status: "ended" });
  }

  // Clear AI context cache
  clearContext(sessionId);
}

/**
 * Start a demo scenario with pre-made transcript
 * This creates a session with existing conversation history
 * and notifies the agent dashboard
 */
export async function startScenarioSession(
  scenarioId: string,
  transcript: Array<{ speaker: 'AI' | 'CUSTOMER'; text: string; timestamp: number }>,
  aiContext: string
): Promise<{ sessionId: string }> {
  const sessionId = `chat-${uuidv4()}`;
  const startTime = transcript[0]?.timestamp || Date.now();

  // Create the session with pre-populated transcript
  const session: CallSession = {
    callId: sessionId,
    customerId: null,
    mode: "AI_AGENT",
    status: "active",
    startTime,
    transcript: transcript.map(t => ({
      speaker: t.speaker,
      text: t.text,
      timestamp: t.timestamp,
    })),
    switchCount: 0,
    metadata: {
      channel: "chat",
      serviceType: "utility",
      scenarioId,
      aiContext, // Store the context for the AI to use
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
        startedAt: new Date(startTime),
        transcript: transcript as any,
      },
    });
  } catch (error) {
    console.error("Failed to create scenario chat record:", error);
  }

  // Get the last message for the preview
  const lastMessage = transcript[transcript.length - 1];
  const previewSpeaker = lastMessage?.speaker === 'AI' ? 'AI' : 'Customer';
  const previewText = lastMessage?.text.substring(0, 50) || 'Demo scenario';

  // Notify agents about the new chat in queue
  emitQueueAdd({
    id: sessionId,
    type: "chat",
    customerName: `Demo: ${scenarioId.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}`,
    waitTime: 0,
    preview: `${previewSpeaker}: ${previewText}...`,
    mode: "AI_AGENT",
    createdAt: startTime,
  });

  // Emit each transcript entry to the agent dashboard with slight delays
  // so they appear in order
  for (let i = 0; i < transcript.length; i++) {
    const entry = transcript[i];
    // Small delay between emissions to ensure proper ordering
    setTimeout(() => {
      emitTranscriptUpdate(sessionId, {
        speaker: entry.speaker,
        text: entry.text,
        timestamp: entry.timestamp,
      });
    }, i * 50);
  }

  console.log(`🎬 Started scenario "${scenarioId}" with session ${sessionId}`);

  return { sessionId };
}
