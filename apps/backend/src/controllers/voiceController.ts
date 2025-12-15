/**
 * Voice Controller
 *
 * API endpoints for voice call functionality:
 * - Create web calls (browser-based)
 * - Get call status
 * - Retell agent management
 */

import { Router, Request, Response } from "express";
import {
  createWebCall,
  getCallDetails,
  checkRetellStatus,
  createUtilityLLM,
  createUtilityLLMWithDynamicKB,
  updateAgentPrompt,
  getAgentDetails,
  hasRetellConfig,
  hasRetellChatConfig,
  isChatConfigured,
  createChatAgent,
  UTILITY_VOICE_AGENT_PROMPT,
  UTILITY_KNOWLEDGE_BASE,
  getFullVoiceAgentPrompt,
} from "../services/voice/retellClient.js";
import { createSession } from "../services/state/sessionStore.js";
import { prisma } from "database";
import { v4 as uuidv4 } from "uuid";

const router = Router();

/**
 * GET /api/voice/status
 *
 * Check Retell voice service status
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await checkRetellStatus();
    res.json(status);
  } catch (error) {
    console.error("❌ Voice status error:", error);
    res.status(500).json({ error: "Failed to check voice status" });
  }
});

/**
 * POST /api/voice/web-call
 *
 * Create a web call for browser-based voice interaction
 *
 * Body:
 * {
 *   customerId?: string,
 *   metadata?: Record<string, string>
 * }
 *
 * Returns:
 * {
 *   callId: string,
 *   accessToken: string,
 *   agentId: string
 * }
 */
router.post("/web-call", async (req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({
        error: "Voice service not configured",
        message: "Set RETELL_API_KEY and RETELL_AGENT_ID in environment",
      });
      return;
    }

    const { customerId, metadata } = req.body;

    // Create a session ID for tracking
    const sessionId = `voice-${uuidv4()}`;

    // Create the Retell web call
    const webCall = await createWebCall({
      ...metadata,
      session_id: sessionId,
      customer_id: customerId,
    });

    // Create session in Redis
    await createSession(sessionId, {
      callId: sessionId,
      customerId: customerId || null,
      mode: "AI_AGENT",
      status: "active",
      startTime: Date.now(),
      transcript: [],
      switchCount: 0,
      metadata: {
        channel: "voice",
        serviceType: "utility",
        retellCallId: webCall.call_id,
      },
    });

    // Create call record in database
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
      console.error("Failed to create call record:", error);
    }

    console.log(`🎤 Web call created: ${sessionId} -> Retell: ${webCall.call_id}`);

    res.json({
      sessionId,
      callId: webCall.call_id,
      accessToken: webCall.access_token,
      agentId: webCall.agent_id,
    });
  } catch (error) {
    console.error("❌ Create web call error:", error);
    res.status(500).json({
      error: "Failed to create web call",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/voice/call/:callId
 *
 * Get call details and transcript
 */
router.get("/call/:callId", async (req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Voice service not configured" });
      return;
    }

    const { callId } = req.params;
    const details = await getCallDetails(callId);

    res.json(details);
  } catch (error) {
    console.error("❌ Get call details error:", error);
    res.status(500).json({ error: "Failed to get call details" });
  }
});

/**
 * GET /api/voice/agent
 *
 * Get current agent configuration
 */
router.get("/agent", async (_req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Voice service not configured" });
      return;
    }

    const agent = await getAgentDetails();
    const fullPrompt = getFullVoiceAgentPrompt();
    
    res.json({
      ...agent,
      promptLength: fullPrompt.length,
      hasKnowledgeBase: true,
      knowledgeBasePreview: UTILITY_KNOWLEDGE_BASE.substring(0, 300) + "...",
      promptPreview: UTILITY_VOICE_AGENT_PROMPT.substring(0, 300) + "...",
    });
  } catch (error) {
    console.error("❌ Get agent error:", error);
    res.status(500).json({ error: "Failed to get agent details" });
  }
});

/**
 * GET /api/voice/knowledge-base
 *
 * Get the full knowledge base content used by the voice agent
 */
router.get("/knowledge-base", async (_req: Request, res: Response) => {
  res.json({
    content: UTILITY_KNOWLEDGE_BASE,
    length: UTILITY_KNOWLEDGE_BASE.length,
    categories: [
      "BILLING & PAYMENTS",
      "PAYMENT ASSISTANCE", 
      "SERVICE FEES",
      "OUTAGES",
      "GAS EMERGENCY",
      "NEW SERVICE",
      "SERVICE CHANGES",
      "SMART METERS",
      "HIGH BILLS",
      "ENERGY EFFICIENCY",
      "CONTACT INFORMATION"
    ],
  });
});

/**
 * POST /api/voice/agent/update-prompt
 *
 * Update the agent's LLM prompt to use utility-focused context
 * Use this to sync your Retell agent with the utility prompt
 *
 * Body:
 * {
 *   llmId: string  // The LLM ID to update (get from /api/voice/agent)
 * }
 */
router.post("/agent/update-prompt", async (req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Voice service not configured" });
      return;
    }

    const { llmId } = req.body;

    if (!llmId) {
      res.status(400).json({
        error: "llmId is required",
        message: "Get the llmId from GET /api/voice/agent",
      });
      return;
    }

    await updateAgentPrompt(llmId);

    res.json({
      success: true,
      message: "Agent prompt updated to utility-focused context",
    });
  } catch (error) {
    console.error("❌ Update prompt error:", error);
    res.status(500).json({ error: "Failed to update agent prompt" });
  }
});

/**
 * POST /api/voice/agent/create-llm
 *
 * Create a new LLM with utility-focused prompt and static knowledge base
 * Use this if you need to create a new LLM for your agent
 */
router.post("/agent/create-llm", async (_req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Voice service not configured" });
      return;
    }

    const llm = await createUtilityLLM();

    res.json({
      success: true,
      llmId: llm.llm_id,
      hasKnowledgeBase: true,
      message: "LLM created with utility knowledge base. Update your Retell agent to use this LLM ID.",
      nextSteps: [
        "1. Go to Retell dashboard",
        "2. Select your agent",
        "3. Update the LLM ID to: " + llm.llm_id,
        "Or use the API to update the agent",
      ],
    });
  } catch (error) {
    console.error("❌ Create LLM error:", error);
    res.status(500).json({ error: "Failed to create LLM" });
  }
});

/**
 * POST /api/voice/agent/create-llm-dynamic
 *
 * Create a new LLM with dynamic knowledge base from database
 * Use this to include the latest knowledge base articles
 */
router.post("/agent/create-llm-dynamic", async (_req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Voice service not configured" });
      return;
    }

    const llm = await createUtilityLLMWithDynamicKB();

    res.json({
      success: true,
      llmId: llm.llm_id,
      hasKnowledgeBase: true,
      knowledgeBaseSource: "database",
      message: "LLM created with dynamic knowledge base from database.",
      nextSteps: [
        "1. Go to Retell dashboard",
        "2. Select your agent", 
        "3. Update the LLM ID to: " + llm.llm_id,
      ],
    });
  } catch (error) {
    console.error("❌ Create dynamic LLM error:", error);
    res.status(500).json({ error: "Failed to create LLM with dynamic KB" });
  }
});

/**
 * GET /api/voice/chat/status
 *
 * Check if Retell chat is configured
 */
router.get("/chat/status", async (_req: Request, res: Response) => {
  res.json({
    configured: isChatConfigured(),
    chatAgentId: hasRetellChatConfig() ? process.env.RETELL_CHAT_AGENT_ID : null,
    voiceAgentId: hasRetellConfig() ? process.env.RETELL_AGENT_ID : null,
    unifiedExperience: hasRetellConfig() && hasRetellChatConfig(),
    message: isChatConfigured() 
      ? "Chat and voice use the same Retell AI for unified experience"
      : "Set RETELL_CHAT_AGENT_ID to enable unified text/voice experience",
  });
});

/**
 * POST /api/voice/chat/create-agent
 *
 * Create a Retell chat agent using the same LLM as the voice agent
 * This enables unified voice/text conversation with shared history
 *
 * Body:
 * {
 *   llmId: string  // The LLM ID to use (same as voice agent)
 * }
 */
router.post("/chat/create-agent", async (req: Request, res: Response) => {
  try {
    if (!hasRetellConfig()) {
      res.status(503).json({ error: "Retell not configured" });
      return;
    }

    const { llmId } = req.body;

    if (!llmId) {
      res.status(400).json({
        error: "llmId is required",
        message: "Get the llmId from GET /api/voice/agent (use the same LLM as voice)",
      });
      return;
    }

    const chatAgent = await createChatAgent(llmId);

    res.json({
      success: true,
      chatAgentId: chatAgent.agent_id,
      chatAgentName: chatAgent.agent_name,
      message: "Chat agent created! Add this to your .env file:",
      envLine: `RETELL_CHAT_AGENT_ID=${chatAgent.agent_id}`,
      nextSteps: [
        "1. Add RETELL_CHAT_AGENT_ID to your .env file",
        "2. Restart the server",
        "3. Text chats will now use the same Retell bot as voice calls",
      ],
    });
  } catch (error) {
    console.error("❌ Create chat agent error:", error);
    res.status(500).json({ 
      error: "Failed to create chat agent",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export { router as voiceController };
