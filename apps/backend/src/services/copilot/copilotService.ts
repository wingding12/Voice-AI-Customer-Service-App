/**
 * Copilot Service - Utility Company Edition
 *
 * Provides real-time AI assistance to customer service representatives.
 * 
 * Features:
 * - Real-time conversation analysis
 * - Context-aware suggestions
 * - Emergency detection
 * - Sentiment monitoring
 * - Knowledge base integration
 */

import type { CopilotSuggestion, TranscriptEntry } from "shared-types";
import { emitCopilotSuggestion } from "../../sockets/agentGateway.js";
import { generateCopilotAnalysis, updateContext } from "../ai/llmService.js";

/**
 * Configuration for the copilot
 */
interface CopilotConfig {
  minConfidence: number;
  maxSuggestions: number;
  sentimentThreshold: number;
}

const DEFAULT_CONFIG: CopilotConfig = {
  minConfidence: 0.5,
  maxSuggestions: 5,
  sentimentThreshold: -0.3,
};

/**
 * Process transcript and generate suggestions
 * 
 * This is the main entry point called whenever a new message
 * is added to a conversation. It analyzes the full context
 * and emits relevant suggestions to the agent.
 */
export async function processTranscript(
  callId: string,
  transcript: TranscriptEntry[],
  config: Partial<CopilotConfig> = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (transcript.length < 1) {
    return;
  }

  try {
    // Update context with new transcript
    await updateContext(callId, transcript);

    // Generate copilot analysis using LLM service
    const analysis = await generateCopilotAnalysis(callId, transcript);

    // Emit high-priority suggestions first
    const prioritizedSuggestions = [...analysis.suggestions].sort((a, b) => {
      // Critical items first
      if (a.metadata?.priority === "CRITICAL") return -1;
      if (b.metadata?.priority === "CRITICAL") return 1;
      // Then by confidence score
      return b.confidenceScore - a.confidenceScore;
    });

    // Emit suggestions above confidence threshold
    let emitted = 0;
    for (const suggestion of prioritizedSuggestions) {
      if (suggestion.confidenceScore >= cfg.minConfidence && emitted < cfg.maxSuggestions) {
        emitCopilotSuggestion(callId, suggestion);
        emitted++;
      }
    }

    // Log analysis for debugging
    console.log(`📊 Copilot analysis for ${callId}: ${analysis.contextSummary}`);
    if (analysis.recommendedAction) {
      console.log(`   Recommended: ${analysis.recommendedAction}`);
    }

  } catch (error) {
    console.error("❌ Copilot processing error:", error);
    
    // Emit a fallback suggestion
    emitCopilotSuggestion(callId, {
      type: "INFO",
      title: "📋 Conversation Active",
      content: `${transcript.length} messages in conversation. Monitoring for insights...`,
      confidenceScore: 0.5,
    });
  }
}

/**
 * Manually trigger a suggestion search
 * 
 * Called when agent explicitly searches the knowledge base
 * from the copilot panel.
 */
export async function triggerSuggestion(
  callId: string,
  query: string
): Promise<void> {
  try {
    // Import dynamically to avoid circular dependencies
    const { smartSearch } = await import("./ragService.js");
    const articles = await smartSearch(query);

    if (articles.length > 0) {
      const topArticle = articles[0];
      emitCopilotSuggestion(callId, {
        type: "INFO",
        title: `📚 ${topArticle.title}`,
        content: topArticle.content,
        confidenceScore: topArticle.similarity,
        metadata: {
          articleId: topArticle.id,
          category: topArticle.category,
          source: "manual_search",
        },
      });

      // Also show other results
      for (let i = 1; i < Math.min(articles.length, 3); i++) {
        emitCopilotSuggestion(callId, {
          type: "INFO",
          title: `📄 ${articles[i].title}`,
          content: articles[i].content.substring(0, 200) + "...",
          confidenceScore: articles[i].similarity,
          metadata: {
            articleId: articles[i].id,
            category: articles[i].category,
          },
        });
      }
    } else {
      emitCopilotSuggestion(callId, {
        type: "INFO",
        title: "🔍 No Results Found",
        content: `No knowledge base articles found for: "${query}"\n\nTry different keywords or check the knowledge base directly.`,
        confidenceScore: 0,
      });
    }
  } catch (error) {
    console.error("❌ Search error:", error);
    emitCopilotSuggestion(callId, {
      type: "INFO",
      title: "❌ Search Error",
      content: "Failed to search knowledge base. Please try again.",
      confidenceScore: 0,
    });
  }
}

/**
 * Generate real-time suggestions as conversation progresses
 * 
 * This can be called more frequently (e.g., after each message)
 * to provide instant feedback to agents.
 */
export async function generateRealtimeSuggestions(
  callId: string,
  transcript: TranscriptEntry[],
  force: boolean = false
): Promise<CopilotSuggestion[]> {
  try {
    const analysis = await generateCopilotAnalysis(callId, transcript, force);
    return analysis.suggestions;
  } catch (error) {
    console.error("❌ Realtime suggestion error:", error);
    return [];
  }
}

/**
 * Get a summary of the current conversation state
 * 
 * Useful for displaying context to agents when they
 * first join a conversation.
 */
export async function getConversationSummary(
  callId: string,
  transcript: TranscriptEntry[]
): Promise<{ summary: string; priority: string; intents: string[] }> {
  try {
    const analysis = await generateCopilotAnalysis(callId, transcript, true);
    
    return {
      summary: analysis.contextSummary,
      priority: analysis.priority,
      intents: [], // Could be extracted from context
    };
  } catch (error) {
    console.error("❌ Summary generation error:", error);
    return {
      summary: `${transcript.length} messages in conversation`,
      priority: "medium",
      intents: [],
    };
  }
}
