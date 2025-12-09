/**
 * Copilot Service
 *
 * Ties together intent detection, RAG search, and suggestion generation
 * to provide real-time assistance to human representatives.
 */

import type { CopilotSuggestion, TranscriptEntry } from "shared-types";
import {
  detectIntent,
  analyzeSentiment,
  hasAssemblyAIConfig,
  type DetectedIntent,
} from "./assemblyaiClient.js";
import { smartSearch, hasOpenAIConfig, type RelevantArticle } from "./ragService.js";
import { emitCopilotSuggestion } from "../../sockets/agentGateway.js";

/**
 * Configuration for the copilot
 */
interface CopilotConfig {
  minConfidence: number;
  maxSuggestions: number;
  sentimentThreshold: number;
}

const DEFAULT_CONFIG: CopilotConfig = {
  minConfidence: 0.6,
  maxSuggestions: 3,
  sentimentThreshold: -0.3, // Trigger escalation below this
};

/**
 * Process transcript and generate suggestions
 *
 * This is the main entry point for copilot analysis.
 *
 * @param callId - Call ID to emit suggestions to
 * @param transcript - Current conversation transcript
 * @param config - Optional configuration overrides
 */
export async function processTranscript(
  callId: string,
  transcript: TranscriptEntry[],
  config: Partial<CopilotConfig> = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Need at least 2 entries to analyze
  if (transcript.length < 2) {
    return;
  }

  // Format for analysis
  const formattedTranscript = transcript.map((t) => ({
    speaker: t.speaker,
    text: t.text,
  }));

  // Run analysis in parallel
  const [intent, sentiment] = await Promise.all([
    hasAssemblyAIConfig()
      ? detectIntent(formattedTranscript)
      : fallbackIntentDetection(formattedTranscript),
    hasAssemblyAIConfig()
      ? analyzeSentiment(formattedTranscript)
      : { overall: "neutral" as const, score: 0, customerFrustration: false },
  ]);

  // Generate suggestions based on intent
  const suggestions = await generateSuggestions(
    callId,
    intent,
    formattedTranscript,
    cfg
  );

  // Emit each suggestion to the frontend
  for (const suggestion of suggestions.slice(0, cfg.maxSuggestions)) {
    emitCopilotSuggestion(callId, suggestion);
  }

  // Check for escalation trigger
  if (sentiment.customerFrustration || sentiment.score < cfg.sentimentThreshold) {
    emitCopilotSuggestion(callId, {
      type: "ACTION",
      title: "⚠️ Customer Frustration Detected",
      content:
        "The customer seems frustrated. Consider acknowledging their concerns and offering a concrete solution.",
      confidenceScore: 0.9,
      metadata: {
        sentiment: sentiment.overall,
        sentimentScore: String(sentiment.score),
      },
    });
  }
}

/**
 * Generate suggestions based on detected intent
 */
async function generateSuggestions(
  callId: string,
  intent: DetectedIntent,
  transcript: Array<{ speaker: string; text: string }>,
  config: CopilotConfig
): Promise<CopilotSuggestion[]> {
  const suggestions: CopilotSuggestion[] = [];

  // Skip low confidence intents
  if (intent.confidence < config.minConfidence) {
    return suggestions;
  }

  // Get the last customer message for context
  const lastCustomerMessage = [...transcript]
    .reverse()
    .find((t) => t.speaker === "CUSTOMER");

  // Search knowledge base based on intent
  const searchQuery = getSearchQueryForIntent(intent, lastCustomerMessage?.text);
  const articles = searchQuery ? await smartSearch(searchQuery) : [];

  // Generate intent-specific suggestions
  switch (intent.intent) {
    case "order_status":
      suggestions.push(
        createOrderStatusSuggestion(intent.entities, articles)
      );
      break;

    case "refund_request":
      suggestions.push(
        createRefundSuggestion(intent.entities, articles)
      );
      break;

    case "product_question":
      suggestions.push(
        createProductSuggestion(intent.entities, articles)
      );
      break;

    case "complaint":
      suggestions.push(createComplaintSuggestion(articles));
      break;

    default:
      // For unknown intents, provide relevant articles if found
      if (articles.length > 0) {
        suggestions.push(createArticleSuggestion(articles));
      }
  }

  // Add suggested action if available
  if (intent.suggestedAction) {
    suggestions.push({
      type: "ACTION",
      title: "💡 Suggested Action",
      content: intent.suggestedAction,
      confidenceScore: intent.confidence,
    });
  }

  return suggestions;
}

/**
 * Create search query based on intent
 */
function getSearchQueryForIntent(
  intent: DetectedIntent,
  lastMessage?: string
): string {
  switch (intent.intent) {
    case "order_status":
      return "order status tracking delivery";
    case "refund_request":
      return "refund return policy process";
    case "product_question":
      return lastMessage || "product information";
    case "complaint":
      return "complaint resolution escalation";
    default:
      return lastMessage || "";
  }
}

/**
 * Create order status suggestion
 */
function createOrderStatusSuggestion(
  entities: Record<string, string>,
  articles: RelevantArticle[]
): CopilotSuggestion {
  const orderId = entities.order_id;
  const article = articles[0];

  let content = orderId
    ? `Customer is asking about order **${orderId}**. Look up the order status in the system.`
    : "Customer is asking about their order status. Ask for their order number or email to look up the details.";

  if (article) {
    content += `\n\n**Policy:** ${article.content.substring(0, 200)}...`;
  }

  return {
    type: "INFO",
    title: "📦 Order Status Inquiry",
    content,
    confidenceScore: 0.85,
    metadata: orderId ? { orderId } : undefined,
  };
}

/**
 * Create refund suggestion
 */
function createRefundSuggestion(
  entities: Record<string, string>,
  articles: RelevantArticle[]
): CopilotSuggestion {
  const article = articles.find((a) =>
    a.title.toLowerCase().includes("refund") ||
    a.title.toLowerCase().includes("return")
  );

  let content =
    "Customer is requesting a refund. Verify their order details and check eligibility.";

  if (article) {
    content = `**${article.title}**\n\n${article.content}`;
  }

  return {
    type: "INFO",
    title: "💰 Refund Request",
    content,
    confidenceScore: 0.9,
    metadata: entities.order_id ? { orderId: entities.order_id } : undefined,
  };
}

/**
 * Create product question suggestion
 */
function createProductSuggestion(
  entities: Record<string, string>,
  articles: RelevantArticle[]
): CopilotSuggestion {
  const product = entities.product;
  const article = articles[0];

  let content = product
    ? `Customer is asking about **${product}**.`
    : "Customer has a product question.";

  if (article) {
    content += `\n\n**Related Info:** ${article.content.substring(0, 300)}...`;
  }

  return {
    type: "INFO",
    title: "🛍️ Product Question",
    content,
    confidenceScore: 0.8,
  };
}

/**
 * Create complaint suggestion
 */
function createComplaintSuggestion(
  articles: RelevantArticle[]
): CopilotSuggestion {
  const article = articles[0];

  let content =
    "Customer is expressing a complaint. Listen actively, apologize for the inconvenience, and offer a solution.";

  if (article) {
    content += `\n\n**Resolution Guide:** ${article.content.substring(0, 200)}...`;
  }

  return {
    type: "ACTION",
    title: "⚠️ Customer Complaint",
    content,
    confidenceScore: 0.85,
  };
}

/**
 * Create generic article suggestion
 */
function createArticleSuggestion(
  articles: RelevantArticle[]
): CopilotSuggestion {
  const topArticle = articles[0];

  return {
    type: "INFO",
    title: `📚 ${topArticle.title}`,
    content: topArticle.content,
    confidenceScore: topArticle.similarity,
    metadata: {
      articleId: topArticle.id,
      category: topArticle.category,
    },
  };
}

/**
 * Fallback intent detection when AssemblyAI is not configured
 */
function fallbackIntentDetection(
  transcript: Array<{ speaker: string; text: string }>
): DetectedIntent {
  const lastCustomerMessage = [...transcript]
    .reverse()
    .find((t) => t.speaker === "CUSTOMER")?.text?.toLowerCase() || "";

  // Simple keyword matching
  if (
    lastCustomerMessage.includes("order") ||
    lastCustomerMessage.includes("tracking") ||
    lastCustomerMessage.includes("delivery")
  ) {
    return { intent: "order_status", confidence: 0.7, entities: {} };
  }

  if (
    lastCustomerMessage.includes("refund") ||
    lastCustomerMessage.includes("return") ||
    lastCustomerMessage.includes("money back")
  ) {
    return { intent: "refund_request", confidence: 0.7, entities: {} };
  }

  if (
    lastCustomerMessage.includes("angry") ||
    lastCustomerMessage.includes("frustrated") ||
    lastCustomerMessage.includes("terrible") ||
    lastCustomerMessage.includes("worst")
  ) {
    return { intent: "complaint", confidence: 0.7, entities: {} };
  }

  return { intent: "general_inquiry", confidence: 0.5, entities: {} };
}

/**
 * Manually trigger a suggestion (for testing or manual assist)
 */
export async function triggerSuggestion(
  callId: string,
  query: string
): Promise<void> {
  const articles = await smartSearch(query);

  if (articles.length > 0) {
    emitCopilotSuggestion(callId, createArticleSuggestion(articles));
  } else {
    emitCopilotSuggestion(callId, {
      type: "INFO",
      title: "🔍 No Results Found",
      content: `No knowledge base articles found for: "${query}"`,
      confidenceScore: 0,
    });
  }
}

