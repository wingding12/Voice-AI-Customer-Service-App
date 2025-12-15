import { Router, Request, Response } from "express";
import { prisma } from "database";
import { TeXML } from "../services/voice/telnyxClient.js";
import {
  registerPhoneCall,
  hasRetellConfig,
} from "../services/voice/retellClient.js";
import {
  createSession,
  getSession,
  updateSession,
} from "../services/state/sessionStore.js";
import {
  emitCallStateUpdate,
  emitCallEnd,
  emitMetricsUpdate,
  emitMetricEvent,
} from "../sockets/agentGateway.js";
import type { CallSession } from "shared-types";

const router = Router();

// Telnyx webhook event types
interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      connection_id: string;
      from: string;
      to: string;
      direction: "incoming" | "outgoing";
      state: string;
      client_state?: string;
      digit?: string;
    };
  };
}

/**
 * Main Telnyx webhook endpoint
 * Handles all call events: initiated, answered, speak_ended, dtmf, hangup, etc.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const event: TelnyxWebhookEvent = req.body;
    const { event_type, payload } = event.data;

    console.log(`📞 Telnyx event: ${event_type}`, {
      callControlId: payload.call_control_id,
      from: payload.from,
      to: payload.to,
      state: payload.state,
    });

    switch (event_type) {
      case "call.initiated":
        await handleCallInitiated(payload, res);
        break;

      case "call.answered":
        await handleCallAnswered(payload, res);
        break;

      case "call.dtmf.received":
        await handleDTMF(payload, res);
        break;

      case "call.hangup":
        await handleCallHangup(payload, res);
        break;

      case "call.speak.ended":
      case "call.playback.ended":
        // Acknowledgement only
        res.status(200).send();
        break;

      default:
        console.log(`⚠️ Unhandled event type: ${event_type}`);
        res.status(200).send();
    }
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Handle incoming call - create session, optionally register with Retell
 */
async function handleCallInitiated(
  payload: TelnyxWebhookEvent["data"]["payload"],
  res: Response
): Promise<void> {
  const { call_control_id, call_session_id, from, to, direction } = payload;

  // Only handle incoming calls
  if (direction !== "incoming") {
    res.status(200).send();
    return;
  }

  // Create call record in database
  try {
    await prisma.call.create({
      data: {
        id: call_session_id,
        mode: "AI_AGENT",
        status: "RINGING",
        startedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to create call record:", error);
  }

  // Create session in Redis
  const session: CallSession = {
    callId: call_session_id,
    customerId: null, // Will be identified later
    mode: "AI_AGENT",
    status: "ringing",
    startTime: Date.now(),
    transcript: [],
    switchCount: 0,
    metadata: {
      callControlId: call_control_id,
      from,
      to,
    },
  };

  await createSession(call_session_id, session);

  // If Retell is configured, register the call with Retell AI
  if (hasRetellConfig()) {
    try {
      const retellCall = await registerPhoneCall(from, to, {
        telnyx_call_id: call_session_id,
        telnyx_call_control_id: call_control_id,
      });

      // Update session with Retell call ID
      await updateSession(call_session_id, {
        metadata: {
          ...session.metadata,
          retellCallId: retellCall.call_id,
        },
      });

      console.log(`🤖 Call registered with Retell: ${retellCall.call_id}`);

      // Retell will handle the conversation via its own greeting
      // We just answer the call and let Retell take over
      const greeting = `Welcome to Utility Support. Our AI assistant will help you now. Press 0 at any time for a human.`;
      res.set("Content-Type", "application/xml");
      res.send(TeXML.answerAndGreet(greeting, true));
    } catch (error) {
      console.error("❌ Failed to register call with Retell:", error);
      // Fall back to basic greeting without Retell
      const fallbackGreeting = `Welcome to Utility Customer Service. Press 0 to speak with a representative.`;
      res.set("Content-Type", "application/xml");
      res.send(TeXML.answerAndGreet(fallbackGreeting, true));
    }
  } else {
    // No Retell configured - use basic TeXML greeting
    const greeting = `Welcome to Utility Customer Service. 
      You are currently speaking with our AI assistant. 
      Press 0 at any time to speak with a human representative.
      How can I help you today?`;

    res.set("Content-Type", "application/xml");
    res.send(TeXML.answerAndGreet(greeting, true));
  }
}

/**
 * Handle call answered - update status, notify frontend
 */
async function handleCallAnswered(
  payload: TelnyxWebhookEvent["data"]["payload"],
  res: Response
): Promise<void> {
  const { call_session_id } = payload;

  // Update session status
  await updateSession(call_session_id, { status: "active" });

  // Update database
  try {
    await prisma.call.update({
      where: { id: call_session_id },
      data: { status: "ACTIVE" },
    });
  } catch (error) {
    console.error("Failed to update call record:", error);
  }

  // Notify frontend
  emitCallStateUpdate(call_session_id, {
    callId: call_session_id,
    activeSpeaker: "AI",
    isMuted: false,
    mode: "AI_AGENT",
  });

  // Emit metrics update for dashboards
  emitMetricEvent("call:started", { callId: call_session_id });
  emitMetricsUpdate();

  res.status(200).send();
}

/**
 * Handle DTMF (keypress) - switch agents on 0 or *
 */
async function handleDTMF(
  payload: TelnyxWebhookEvent["data"]["payload"],
  res: Response
): Promise<void> {
  const { call_session_id, digit } = payload;

  console.log(`🔢 DTMF received: ${digit} for call ${call_session_id}`);

  const session = await getSession(call_session_id);
  if (!session) {
    res.status(200).send();
    return;
  }

  if (digit === "0") {
    // Switch to human
    await handleSwitch(call_session_id, "AI_TO_HUMAN", "DTMF_REQUEST");

    const message = "Connecting you with a human representative. Please hold.";
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say(message));
  } else if (digit === "*") {
    // Switch back to AI
    await handleSwitch(call_session_id, "HUMAN_TO_AI", "DTMF_REQUEST");

    const message = "Connecting you back to our AI assistant.";
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say(message));
  } else {
    res.status(200).send();
  }
}

/**
 * Handle call hangup - cleanup session, update database
 */
async function handleCallHangup(
  payload: TelnyxWebhookEvent["data"]["payload"],
  res: Response
): Promise<void> {
  const { call_session_id } = payload;

  // Get final session state
  const session = await getSession(call_session_id);

  // Update Redis session status to ended (prevents further switches)
  if (session) {
    await updateSession(call_session_id, { status: "ended" });
  }

  // Update database
  try {
    await prisma.call.update({
      where: { id: call_session_id },
      data: {
        status: "ENDED",
        endedAt: new Date(),
        transcript: session?.transcript
          ? JSON.parse(JSON.stringify(session.transcript))
          : null,
      },
    });
  } catch (error) {
    console.error("Failed to update call record:", error);
  }

  // Notify frontend that call ended
  emitCallEnd(call_session_id);

  // Emit metrics update for dashboards
  emitMetricEvent("call:ended", { callId: call_session_id });
  emitMetricsUpdate();

  console.log(`📞 Call ended: ${call_session_id}`);
  res.status(200).send();
}

/**
 * Internal switch handler - updates state and logs
 */
async function handleSwitch(
  callId: string,
  direction: "AI_TO_HUMAN" | "HUMAN_TO_AI",
  reason: string
): Promise<void> {
  const newMode = direction === "AI_TO_HUMAN" ? "HUMAN_REP" : "AI_AGENT";

  // Update session
  const session = await getSession(callId);
  if (session) {
    await updateSession(callId, {
      mode: newMode as "AI_AGENT" | "HUMAN_REP",
      switchCount: session.switchCount + 1,
    });
  }

  // Log switch in database
  try {
    await prisma.switchLog.create({
      data: {
        callId,
        direction,
        reason,
      },
    });

    await prisma.call.update({
      where: { id: callId },
      data: { mode: newMode as "AI_AGENT" | "HUMAN_REP" },
    });
  } catch (error) {
    console.error("Failed to log switch:", error);
  }

  // Notify frontend
  emitCallStateUpdate(callId, {
    callId,
    activeSpeaker: direction === "AI_TO_HUMAN" ? "HUMAN" : "AI",
    isMuted: false,
    mode: newMode as "AI_AGENT" | "HUMAN_REP",
  });

  // Emit metrics update for dashboards
  emitMetricEvent("switch:occurred", { callId, direction, reason });
  emitMetricsUpdate();

  console.log(`🔄 Switch: ${direction} for call ${callId} (reason: ${reason})`);
}

/**
 * Gather endpoint for DTMF collection
 * Telnyx TeXML sends: CallSessionId, CallLegId, CallControlId, Digits, etc.
 */
router.post("/gather", async (req: Request, res: Response) => {
  // Telnyx TeXML uses CallSessionId, but we also check CallSid for compatibility
  const { Digits, CallSessionId, CallSid } = req.body;
  const callId = CallSessionId || CallSid;

  console.log(`🔢 Gathered digits: ${Digits} for call ${callId}`);
  console.log(`📋 Gather callback body:`, JSON.stringify(req.body, null, 2));

  if (!callId) {
    console.error("❌ No call ID in gather callback");
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say("Sorry, there was an error. Please try again."));
    return;
  }

  // Process the same as dtmf.received
  if (Digits === "0") {
    // Switch to human
    await handleSwitch(callId, "AI_TO_HUMAN", "DTMF_GATHER");
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say("Connecting you with a human representative."));
  } else if (Digits === "*") {
    // Switch back to AI
    await handleSwitch(callId, "HUMAN_TO_AI", "DTMF_GATHER");
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say("Connecting you back to our AI assistant."));
  } else {
    // Unknown digit - continue conversation
    res.set("Content-Type", "application/xml");
    res.send(TeXML.say("I didn't understand that. How can I help you?"));
  }
});

export { router as callController };
