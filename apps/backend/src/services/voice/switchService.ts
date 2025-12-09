/**
 * Switch Service
 *
 * Handles seamless handoff between AI and Human agents using
 * the Conference Bridge pattern:
 *
 * 1. Customer is always in a conference room
 * 2. AI Agent and Human Rep are participants
 * 3. Switch = mute one, unmute the other
 * 4. No call drops, seamless transition
 */

import { prisma } from "database";
import {
  getSession,
  updateSession,
} from "../state/sessionStore.js";
import {
  emitCallStateUpdate,
  emitSwitchEvent,
} from "../../sockets/agentGateway.js";
import {
  muteParticipant,
  unmuteParticipant,
  speakText,
} from "./telnyxClient.js";
import { endCall as endRetellCall, hasRetellConfig } from "./retellClient.js";
import type { CallMode, SpeakerType } from "shared-types";

/**
 * Switch request parameters
 */
export interface SwitchRequest {
  callId: string;
  direction: "AI_TO_HUMAN" | "HUMAN_TO_AI";
  reason?: string;
}

/**
 * Switch result
 */
export interface SwitchResult {
  success: boolean;
  newMode: CallMode;
  timestamp: number;
  error?: string;
}

/**
 * Execute a switch between AI and Human agent
 *
 * This is the main entry point for switching.
 *
 * @param request - Switch request parameters
 * @returns Result of the switch operation
 */
export async function executeSwitch(request: SwitchRequest): Promise<SwitchResult> {
  const { callId, direction, reason } = request;
  const timestamp = Date.now();

  console.log(`🔄 Executing switch: ${direction} for call ${callId}`);

  try {
    // Get current session
    const session = await getSession(callId);
    if (!session) {
      return {
        success: false,
        newMode: "AI_AGENT",
        timestamp,
        error: "Session not found",
      };
    }

    // Validate switch is allowed
    const currentMode = session.mode;
    if (
      (direction === "AI_TO_HUMAN" && currentMode === "HUMAN_REP") ||
      (direction === "HUMAN_TO_AI" && currentMode === "AI_AGENT")
    ) {
      return {
        success: false,
        newMode: currentMode,
        timestamp,
        error: `Already in ${currentMode} mode`,
      };
    }

    // Determine new mode
    const newMode: CallMode = direction === "AI_TO_HUMAN" ? "HUMAN_REP" : "AI_AGENT";

    // Execute the actual switch based on direction
    if (direction === "AI_TO_HUMAN") {
      await switchToHuman(callId, session.metadata);
    } else {
      await switchToAI(callId, session.metadata);
    }

    // Update session
    await updateSession(callId, {
      mode: newMode,
      switchCount: session.switchCount + 1,
    });

    // Log to database
    await logSwitchEvent(callId, direction, reason);

    // Update call mode in database
    await prisma.call.update({
      where: { id: callId },
      data: { mode: newMode },
    });

    // Notify frontend
    const activeSpeaker: SpeakerType = direction === "AI_TO_HUMAN" ? "HUMAN" : "AI";
    emitCallStateUpdate(callId, {
      callId,
      activeSpeaker,
      isMuted: false,
      mode: newMode,
    });
    emitSwitchEvent(callId, direction);

    console.log(`✅ Switch complete: ${direction} for call ${callId}`);

    return {
      success: true,
      newMode,
      timestamp,
    };
  } catch (error) {
    console.error(`❌ Switch failed for call ${callId}:`, error);
    return {
      success: false,
      newMode: "AI_AGENT",
      timestamp,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Switch from AI to Human agent
 *
 * Conference Bridge Pattern:
 * 1. Mute the AI agent (or disconnect Retell)
 * 2. Unmute the human rep
 * 3. Play transition message
 *
 * NOTE: Full conference bridge requires Telnyx conference setup during call init.
 * Current implementation uses Retell disconnection as the primary switch mechanism.
 */
async function switchToHuman(
  callId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const conferenceId = metadata.conferenceId as string | undefined;
  const callControlId = metadata.callControlId as string | undefined;
  const retellCallId = metadata.retellCallId as string | undefined;

  console.log(`🔄 switchToHuman: callId=${callId}, conferenceId=${conferenceId}, retellCallId=${retellCallId}`);

  // If using Retell, end the Retell call leg
  if (hasRetellConfig() && retellCallId) {
    try {
      await endRetellCall(retellCallId);
      console.log(`🤖 Retell call ended: ${retellCallId}`);
    } catch (error) {
      console.warn("Failed to end Retell call:", error);
      // Continue anyway - human should take over
    }
  }

  // If in a conference, manage participants
  // NOTE: Conference bridge is optional - works without if using Retell transfer pattern
  if (conferenceId && callControlId) {
    try {
      // Unmute human rep (they were listening muted)
      await unmuteParticipant(conferenceId, callControlId);
    } catch (error) {
      console.warn("Failed to unmute participant:", error);
    }
  } else if (!conferenceId) {
    console.log("ℹ️ No conference bridge configured - using Retell transfer pattern");
  }

  // Play transition message to customer
  if (callControlId) {
    try {
      await speakText(
        callControlId,
        "I'm connecting you with a human representative now. Please hold for just a moment.",
        "female"
      );
    } catch (error) {
      console.warn("Failed to play transition message:", error);
    }
  }
}

/**
 * Switch from Human back to AI agent
 *
 * Conference Bridge Pattern:
 * 1. Mute the human rep
 * 2. Re-activate AI agent (reconnect Retell or unmute)
 * 3. Play transition message
 *
 * NOTE: Reconnecting to Retell mid-call requires initiating a new call leg.
 * This is a limitation of the current architecture.
 */
async function switchToAI(
  callId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const conferenceId = metadata.conferenceId as string | undefined;
  const callControlId = metadata.callControlId as string | undefined;

  console.log(`🔄 switchToAI: callId=${callId}, conferenceId=${conferenceId}`);

  // If in a conference, manage participants
  if (conferenceId && callControlId) {
    try {
      // Mute human rep
      await muteParticipant(conferenceId, callControlId);
    } catch (error) {
      console.warn("Failed to mute participant:", error);
    }
  } else if (!conferenceId) {
    console.log("ℹ️ No conference bridge configured - human→AI switch is mode-only");
    console.log("   Full AI reconnection requires new Retell call leg (not implemented)");
  }

  // Play transition message to customer
  if (callControlId) {
    try {
      await speakText(
        callControlId,
        "Thank you for speaking with our representative. Our AI assistant will continue to help you.",
        "female"
      );
    } catch (error) {
      console.warn("Failed to play transition message:", error);
    }
  }
}

/**
 * Log switch event to database
 */
async function logSwitchEvent(
  callId: string,
  direction: "AI_TO_HUMAN" | "HUMAN_TO_AI",
  reason?: string
): Promise<void> {
  try {
    await prisma.switchLog.create({
      data: {
        callId,
        direction,
        reason: reason || "USER_REQUEST",
      },
    });
  } catch (error) {
    console.error("Failed to log switch event:", error);
    // Don't throw - logging failure shouldn't break the switch
  }
}

/**
 * Get switch statistics for a call
 */
export async function getSwitchStats(callId: string): Promise<{
  totalSwitches: number;
  switches: Array<{
    direction: string;
    reason: string | null;
    timestamp: Date;
  }>;
}> {
  const switches = await prisma.switchLog.findMany({
    where: { callId },
    orderBy: { switchedAt: "asc" },
    select: {
      direction: true,
      reason: true,
      switchedAt: true,
    },
  });

  return {
    totalSwitches: switches.length,
    switches: switches.map((s) => ({
      direction: s.direction,
      reason: s.reason,
      timestamp: s.switchedAt,
    })),
  };
}

/**
 * Check if a switch is currently allowed
 */
export async function canSwitch(
  callId: string,
  direction: "AI_TO_HUMAN" | "HUMAN_TO_AI"
): Promise<{ allowed: boolean; reason?: string }> {
  // Check Redis session first
  const session = await getSession(callId);

  if (!session) {
    // Fallback: check database if session expired from Redis
    const dbCall = await prisma.call.findUnique({
      where: { id: callId },
      select: { status: true, mode: true },
    });

    if (!dbCall) {
      return { allowed: false, reason: "Call not found" };
    }

    if (dbCall.status === "ENDED") {
      return { allowed: false, reason: "Call has ended" };
    }

    return { allowed: false, reason: "Session expired" };
  }

  if (session.status !== "active") {
    return { allowed: false, reason: "Call is not active" };
  }

  const currentMode = session.mode;
  if (
    (direction === "AI_TO_HUMAN" && currentMode === "HUMAN_REP") ||
    (direction === "HUMAN_TO_AI" && currentMode === "AI_AGENT")
  ) {
    return { allowed: false, reason: `Already in ${currentMode} mode` };
  }

  return { allowed: true };
}

