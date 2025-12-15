/**
 * Copilot Controller
 * 
 * API endpoints for the AI copilot functionality:
 * - Knowledge base search
 * - Real-time suggestions
 * - Conversation summary
 */

import { Router, Request, Response } from "express";
import { triggerSuggestion, getConversationSummary, generateRealtimeSuggestions } from "../services/copilot/copilotService.js";
import { smartSearch } from "../services/copilot/ragService.js";
import { getSession } from "../services/state/sessionStore.js";
import { isLLMAvailable } from "../services/ai/llmService.js";

const router = Router();

/**
 * GET /api/copilot/status
 * 
 * Check copilot service status
 */
router.get("/status", async (_req: Request, res: Response) => {
  // Check if Retell is configured for voice
  const { hasRetellConfig } = await import("../config/env.js");
  const retellAvailable = hasRetellConfig();

  res.json({
    available: true,
    llmEnabled: isLLMAvailable(),
    llmProvider: isLLMAvailable() ? "gemini" : "none",
    unifiedAI: true,
    architecture: {
      description: "Voice and Chat use the same AI personality and knowledge base",
      voice: {
        provider: retellAvailable ? "retell" : "not_configured",
        status: retellAvailable ? "active" : "requires_config",
      },
      chat: {
        provider: isLLMAvailable() ? "gemini" : "fallback",
        status: isLLMAvailable() ? "active" : "limited",
      },
      knowledgeBase: "shared",
    },
    features: {
      suggestions: true,
      knowledgeBase: true,
      sentimentAnalysis: true,
      intentDetection: true,
      dynamicResponses: isLLMAvailable(),
      voiceCalls: retellAvailable,
      textChat: true,
    },
  });
});

/**
 * POST /api/copilot/search
 * 
 * Search the knowledge base
 * 
 * Body:
 * {
 *   query: string,
 *   sessionId?: string,  // If provided, will emit suggestions via Socket.io
 *   limit?: number
 * }
 */
router.post("/search", async (req: Request, res: Response) => {
  try {
    const { query, sessionId, limit = 5 } = req.body;

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query is required" });
      return;
    }

    // If sessionId provided, emit via Socket.io
    if (sessionId) {
      await triggerSuggestion(sessionId, query);
      res.json({ success: true, message: "Suggestions sent via Socket.io" });
      return;
    }

    // Otherwise return results directly
    const results = await smartSearch(query, limit);
    
    res.json({
      results: results.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        relevance: r.similarity,
      })),
      count: results.length,
    });
  } catch (error) {
    console.error("❌ Copilot search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

/**
 * GET /api/copilot/summary/:sessionId
 * 
 * Get conversation summary for a session
 */
router.get("/summary/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const summary = await getConversationSummary(sessionId, session.transcript || []);
    
    res.json({
      sessionId,
      ...summary,
      messageCount: session.transcript?.length || 0,
      mode: session.mode,
      startTime: session.startTime,
    });
  } catch (error) {
    console.error("❌ Copilot summary error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

/**
 * POST /api/copilot/suggestions
 * 
 * Generate suggestions for a session
 * 
 * Body:
 * {
 *   sessionId: string,
 *   emit?: boolean  // If true, emit via Socket.io instead of returning
 * }
 */
router.post("/suggestions", async (req: Request, res: Response) => {
  try {
    const { sessionId, emit = false } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "sessionId is required" });
      return;
    }

    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Import and use generateCopilotAnalysis directly with force=true
    const { generateCopilotAnalysis } = await import("../services/ai/llmService.js");
    const analysis = await generateCopilotAnalysis(sessionId, session.transcript || [], true);
    const suggestions = analysis.suggestions;

    console.log(`🎯 Copilot suggestions generated for ${sessionId}: ${suggestions.length} suggestions`);

    if (emit) {
      // Import and emit via socket
      const { emitCopilotSuggestion } = await import("../sockets/agentGateway.js");
      for (const suggestion of suggestions) {
        emitCopilotSuggestion(sessionId, suggestion);
      }
      res.json({ success: true, count: suggestions.length });
    } else {
      res.json({ suggestions });
    }
  } catch (error) {
    console.error("❌ Copilot suggestions error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

/**
 * GET /api/copilot/articles
 * 
 * Get all knowledge base articles (for browsing)
 */
router.get("/articles", async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import("database");
    
    const articles = await prisma.knowledgeArticle.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        content: true,
        createdAt: true,
      },
      orderBy: { category: "asc" },
    });

    // Group by category
    const byCategory: Record<string, typeof articles> = {};
    for (const article of articles) {
      if (!byCategory[article.category]) {
        byCategory[article.category] = [];
      }
      byCategory[article.category].push(article);
    }

    res.json({
      articles,
      byCategory,
      totalCount: articles.length,
    });
  } catch (error) {
    console.error("❌ Get articles error:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

export { router as copilotController };

