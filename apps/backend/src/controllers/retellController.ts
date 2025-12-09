/**
 * Retell Webhook Controller
 *
 * Handles webhook events from Retell AI:
 * - call_started: Call has begun
 * - call_ended: Call has ended (includes transcript)
 * - call_analyzed: Post-call analysis complete
 * - agent_response: Real-time agent responses (for live transcript)
 */

import { Router, Request, Response } from "express";
import { prisma } from "database";
import {
  getSession,
  updateSession,
  appendTranscript,
} from "../services/state/sessionStore.js";
import {
  emitTranscriptUpdate,
  emitCallStateUpdate,
  emitCallEnd,
} from "../sockets/agentGateway.js";
import { verifyWebhookSignature, hasRetellConfig } from "../services/voice/retellClient.js";
import { env } from "../config/env.js";

const router = Router();

// Retell webhook event types
interface RetellWebhookEvent {
  event: string;
  call: {
    call_id: string;
    agent_id: string;
    call_status: string;
    start_timestamp?: number;
    end_timestamp?: number;
    transcript?: string;
    transcript_object?: Array<{
      role: "agent" | "user";
      content: string;
      words?: Array<{
        word: string;
        start: number;
        end: number;
      }>;
    }>;
    recording_url?: string;
    public_log_url?: string;
    disconnection_reason?: string;
    call_analysis?: {
      call_summary?: string;
      user_sentiment?: string;
      call_successful?: boolean;
      custom_analysis_data?: Record<string, unknown>;
    };
    metadata?: Record<string, string>;
  };
}

// Real-time transcript update (sent during call)
interface RetellTranscriptEvent {
  event: "transcript";
  call_id: string;
  role: "agent" | "user";
  content: string;
  timestamp: number;
}

/**
 * Main Retell webhook endpoint
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Verify webhook signature if API key is configured
    if (hasRetellConfig() && env.RETELL_API_KEY) {
      const signature = req.headers["x-retell-signature"] as string;
      const rawBody = JSON.stringify(req.body);

      if (signature && !verifyWebhookSignature(rawBody, signature, env.RETELL_API_KEY)) {
        console.warn("⚠️ Invalid Retell webhook signature");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }

    const event = req.body as RetellWebhookEvent | RetellTranscriptEvent;

    console.log(`🤖 Retell webhook: ${event.event}`, {
      callId: "call" in event ? event.call.call_id : event.call_id,
    });

    switch (event.event) {
      case "call_started":
        await handleCallStarted(event as RetellWebhookEvent, res);
        break;

      case "call_ended":
        await handleCallEnded(event as RetellWebhookEvent, res);
        break;

      case "call_analyzed":
        await handleCallAnalyzed(event as RetellWebhookEvent, res);
        break;

      case "transcript":
        await handleTranscriptUpdate(event as RetellTranscriptEvent, res);
        break;

      default:
        console.log(`⚠️ Unhandled Retell event: ${event.event}`);
        res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error("❌ Retell webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Handle call started event
 */
async function handleCallStarted(
  event: RetellWebhookEvent,
  res: Response
): Promise<void> {
  const { call } = event;
  const callId = call.metadata?.telnyx_call_id || call.call_id;

  console.log(`🤖 Retell call started: ${call.call_id}`);

  // Update session with Retell call ID
  const session = await getSession(callId);
  if (session) {
    await updateSession(callId, {
      metadata: {
        ...session.metadata,
        retellCallId: call.call_id,
      },
    });
  }

  // Notify frontend that AI is now active
  emitCallStateUpdate(callId, {
    callId,
    activeSpeaker: "AI",
    isMuted: false,
    mode: "AI_AGENT",
  });

  res.status(200).json({ received: true });
}

/**
 * Handle call ended event - includes full transcript
 */
async function handleCallEnded(
  event: RetellWebhookEvent,
  res: Response
): Promise<void> {
  const { call } = event;
  const callId = call.metadata?.telnyx_call_id || call.call_id;

  console.log(`🤖 Retell call ended: ${call.call_id}`, {
    reason: call.disconnection_reason,
    duration: call.end_timestamp && call.start_timestamp
      ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
      : "unknown",
  });

  // Parse transcript into our format
  const transcriptEntries = parseTranscript(call.transcript_object || []);

  // Update session with final transcript
  const session = await getSession(callId);
  if (session) {
    await updateSession(callId, {
      transcript: transcriptEntries,
      status: "ended",
    });
  }

  // Update database with transcript
  try {
    await prisma.call.update({
      where: { id: callId },
      data: {
        transcript: JSON.parse(JSON.stringify(transcriptEntries)),
      },
    });
  } catch (error) {
    console.error("Failed to save transcript:", error);
  }

  // Notify frontend
  emitCallEnd(callId);

  res.status(200).json({ received: true });
}

/**
 * Handle call analyzed event - post-call analysis
 */
async function handleCallAnalyzed(
  event: RetellWebhookEvent,
  res: Response
): Promise<void> {
  const { call } = event;
  const callId = call.metadata?.telnyx_call_id || call.call_id;

  console.log(`🤖 Retell call analyzed: ${call.call_id}`, {
    sentiment: call.call_analysis?.user_sentiment,
    successful: call.call_analysis?.call_successful,
  });

  // Store analysis in call metadata (could extend schema later)
  if (call.call_analysis) {
    try {
      // For now, we can store analysis in the transcript field as JSON
      // In production, you'd want a dedicated call_analysis table
      const existingCall = await prisma.call.findUnique({
        where: { id: callId },
      });

      if (existingCall) {
        const currentTranscript = existingCall.transcript as Record<string, unknown> || {};
        // Serialize analysis to ensure Prisma JSON compatibility
        const analysisData = JSON.parse(JSON.stringify(call.call_analysis));
        await prisma.call.update({
          where: { id: callId },
          data: {
            transcript: {
              ...currentTranscript,
              analysis: analysisData,
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to save call analysis:", error);
    }
  }

  res.status(200).json({ received: true });
}

/**
 * Handle real-time transcript update
 */
async function handleTranscriptUpdate(
  event: RetellTranscriptEvent,
  res: Response
): Promise<void> {
  const { call_id, role, content, timestamp } = event;

  // Map Retell role to our speaker type
  const speaker = role === "agent" ? "AI" : "CUSTOMER";

  // Append to session transcript (use Retell's timestamp for consistency)
  await appendTranscript(call_id, speaker as "AI" | "CUSTOMER", content, timestamp);

  // Emit to frontend for live transcript display
  emitTranscriptUpdate(call_id, {
    speaker,
    text: content,
    timestamp,
  });

  res.status(200).json({ received: true });
}

/**
 * Parse Retell transcript object into our format
 */
function parseTranscript(
  transcriptObject: RetellWebhookEvent["call"]["transcript_object"]
): Array<{ speaker: "AI" | "HUMAN" | "CUSTOMER"; text: string; timestamp: number }> {
  if (!transcriptObject || !Array.isArray(transcriptObject)) {
    return [];
  }

  // Calculate base timestamp for fallback (approximate start of conversation)
  const baseTimestamp = Date.now() - transcriptObject.length * 5000;

  return transcriptObject.map((entry, index) => ({
    speaker: entry.role === "agent" ? "AI" as const : "CUSTOMER" as const,
    text: entry.content,
    // Use word timestamps if available, otherwise estimate based on position
    timestamp: entry.words?.[0]?.start ?? (baseTimestamp + index * 5000),
  }));
}

export { router as retellController };

