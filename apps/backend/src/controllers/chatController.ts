/**
 * Chat Controller
 *
 * API endpoints for text chat functionality:
 * - Customer sends message
 * - Human rep sends response
 * - End chat session
 */

import { Router, Request, Response } from "express";
import {
  processMessage,
  sendHumanResponse,
  endChatSession,
} from "../services/chat/chatService.js";
import type { ChatRequest } from "shared-types";

const router = Router();

/**
 * POST /api/chat
 *
 * Process a customer chat message
 *
 * Body:
 * {
 *   message: string,
 *   sessionId?: string  // Optional, will create new session if not provided
 * }
 *
 * Response:
 * {
 *   reply: string,
 *   sessionId: string,
 *   suggestions?: CopilotSuggestion[]
 * }
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body as ChatRequest;

    // Validate request
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    // Process the message
    const response = await processMessage({
      message: message.trim(),
      sessionId,
    });

    res.json(response);
  } catch (error) {
    console.error("❌ Chat endpoint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/chat/respond
 *
 * Human rep sends a response to customer
 *
 * Body:
 * {
 *   sessionId: string,
 *   message: string
 * }
 */
router.post("/respond", async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    await sendHumanResponse(sessionId, message.trim());
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Chat respond error:", error);

    if (error instanceof Error) {
      if (error.message === "Session not found") {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      if (error.message === "Session is not in human mode") {
        res.status(400).json({ error: "Session is not in human mode" });
        return;
      }
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/chat/end
 *
 * End a chat session
 *
 * Body:
 * {
 *   sessionId: string
 * }
 */
router.post("/end", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    await endChatSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ Chat end error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/chat/switch
 *
 * Switch chat session between AI and Human mode
 *
 * Body:
 * {
 *   sessionId: string,
 *   direction: "AI_TO_HUMAN" | "HUMAN_TO_AI"
 * }
 */
router.post("/switch", async (req: Request, res: Response) => {
  try {
    const { sessionId, direction } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    if (!direction || !["AI_TO_HUMAN", "HUMAN_TO_AI"].includes(direction)) {
      res.status(400).json({
        error: "direction must be AI_TO_HUMAN or HUMAN_TO_AI",
      });
      return;
    }

    // Import switch service to reuse logic
    const { executeSwitch } = await import(
      "../services/voice/switchService.js"
    );

    const result = await executeSwitch({
      callId: sessionId,
      direction,
      reason: "CHAT_SWITCH",
    });

    if (result.success) {
      res.json({
        success: true,
        newMode: result.newMode,
        timestamp: result.timestamp,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("❌ Chat switch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as chatController };

