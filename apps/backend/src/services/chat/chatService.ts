/**
 * Chat Service - Utility Company Edition
 *
 * Handles text chat messages for utility customer service:
 * - Billing inquiries
 * - Outage reports
 * - Service changes
 * - Payment assistance
 * - And more utility-specific topics
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
} from "../../sockets/agentGateway.js";
import { processTranscript } from "../copilot/copilotService.js";
import { smartSearch } from "../copilot/ragService.js";
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

  // Generate response based on mode
  let reply: string;

  if (session.mode === "AI_AGENT") {
    reply = await generateUtilityAIResponse(sessionId, message, session.transcript);

    const aiTimestamp = Date.now();
    await appendTranscript(sessionId, "AI", reply, aiTimestamp);

    emitTranscriptUpdate(sessionId, {
      speaker: "AI",
      text: reply,
      timestamp: aiTimestamp,
    });
  } else {
    reply = "A customer service representative will respond shortly. Thank you for your patience.";

    emitCallStateUpdate(sessionId, {
      callId: sessionId,
      activeSpeaker: "CUSTOMER",
      isMuted: false,
      mode: "HUMAN_REP",
    });
  }

  // Trigger copilot analysis
  const updatedSession = await getSession(sessionId);
  if (updatedSession && updatedSession.transcript.length >= 2) {
    processTranscript(sessionId, updatedSession.transcript).catch((err) => {
      console.error("❌ Copilot processing error:", err);
    });
  }

  const suggestions = await getCopilotSuggestions(message);

  return {
    reply,
    sessionId,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Generate AI response for utility customer service
 */
async function generateUtilityAIResponse(
  sessionId: string,
  message: string,
  transcript: TranscriptEntry[]
): Promise<string> {
  const lowerMessage = message.toLowerCase();

  // Check for human escalation requests
  if (
    lowerMessage.includes("/human") ||
    lowerMessage.includes("speak to agent") ||
    lowerMessage.includes("talk to human") ||
    lowerMessage.includes("real person") ||
    lowerMessage.includes("speak to someone") ||
    lowerMessage.includes("representative")
  ) {
    await switchToHuman(sessionId);
    return "I'm connecting you with a customer service representative. They'll be with you shortly. Your estimated wait time is under 2 minutes.";
  }

  // EMERGENCY: Gas leak detection - immediate escalation
  if (
    lowerMessage.includes("gas leak") ||
    lowerMessage.includes("smell gas") ||
    lowerMessage.includes("gas smell") ||
    lowerMessage.includes("rotten egg")
  ) {
    await switchToHuman(sessionId, "GAS_EMERGENCY");
    return "⚠️ **IMPORTANT SAFETY NOTICE**\n\n" +
      "If you smell gas:\n" +
      "1. DO NOT turn on/off any electrical switches\n" +
      "2. Leave the building immediately\n" +
      "3. Call 911 and our emergency line: 1-800-GAS-LEAK\n\n" +
      "I'm connecting you with our emergency team immediately.";
  }

  // Search knowledge base
  const articles = await smartSearch(message, 2);

  // Check for utility-specific intents
  
  // Power Outage
  if (
    lowerMessage.includes("power out") ||
    lowerMessage.includes("no power") ||
    lowerMessage.includes("outage") ||
    lowerMessage.includes("lights out")
  ) {
    const article = articles.find(a => a.category === "OUTAGES");
    let response = "I'm sorry to hear you're experiencing a power outage. Let me help you:\n\n";
    response += "**Quick Checks:**\n";
    response += "• Check if your circuit breaker has tripped\n";
    response += "• See if your neighbors also have no power\n\n";
    response += "To report this outage, I'll need your service address. ";
    response += "You can also check our outage map at outage.utilitycompany.com\n\n";
    response += "Would you like to report an outage now?";
    return response;
  }

  // High Bill
  if (
    lowerMessage.includes("high bill") ||
    lowerMessage.includes("bill too high") ||
    lowerMessage.includes("expensive") ||
    lowerMessage.includes("bill went up") ||
    lowerMessage.includes("why is my bill")
  ) {
    let response = "I understand your concern about your bill. High bills can happen for several reasons:\n\n";
    response += "**Common Causes:**\n";
    response += "• Seasonal changes (heating in winter, AC in summer)\n";
    response += "• Rate adjustments\n";
    response += "• Additional appliances or occupants\n\n";
    response += "**I Can Help By:**\n";
    response += "• Comparing your usage to previous months\n";
    response += "• Scheduling a free meter accuracy test\n";
    response += "• Setting up a free home energy audit\n\n";
    response += "Would you like me to look into your account? I'll just need to verify some information first.";
    return response;
  }

  // Payment Issues
  if (
    lowerMessage.includes("can't pay") ||
    lowerMessage.includes("payment plan") ||
    lowerMessage.includes("payment arrangement") ||
    lowerMessage.includes("behind on") ||
    lowerMessage.includes("past due")
  ) {
    let response = "I understand, and I want to help you find a solution. We have several options:\n\n";
    response += "**Payment Arrangements:**\n";
    response += "• Spread your balance over 3-12 months\n";
    response += "• Budget Billing for predictable monthly payments\n\n";
    response += "**Assistance Programs:**\n";
    response += "• LIHEAP (federal assistance for qualifying households)\n";
    response += "• Senior discount (65+)\n";
    response += "• Medical baseline program\n";
    response += "• Hardship fund (one-time assistance up to $300)\n\n";
    response += "Would you like me to check what programs you may qualify for?";
    return response;
  }

  // New Service
  if (
    lowerMessage.includes("new service") ||
    lowerMessage.includes("start service") ||
    lowerMessage.includes("moving in") ||
    lowerMessage.includes("new account")
  ) {
    let response = "Welcome! I'd be happy to help you set up new utility service.\n\n";
    response += "**What You'll Need:**\n";
    response += "• Government-issued ID\n";
    response += "• Social Security Number (for credit check) OR $200 deposit\n";
    response += "• Service address and desired start date\n\n";
    response += "**Connection Fees:**\n";
    response += "• Standard (1-2 days): $35\n";
    response += "• Same-day priority: $75\n\n";
    response += "Would you like to start the new service process now?";
    return response;
  }

  // Moving/Transfer
  if (
    lowerMessage.includes("moving") ||
    lowerMessage.includes("transfer service") ||
    lowerMessage.includes("new address")
  ) {
    let response = "I can help you transfer your service to your new address.\n\n";
    response += "**To Transfer Service, I'll Need:**\n";
    response += "• Your current account number or address\n";
    response += "• Move-out date from current address\n";
    response += "• Move-in date and new address\n\n";
    response += "**Good to Know:**\n";
    response += "• 3-5 business days notice is recommended\n";
    response += "• Your deposit will transfer to the new account\n";
    response += "• Final bill sent within 7 days of move-out\n\n";
    response += "Ready to get started? What's your current address?";
    return response;
  }

  // Stop Service
  if (
    lowerMessage.includes("stop service") ||
    lowerMessage.includes("cancel service") ||
    lowerMessage.includes("disconnect service") ||
    lowerMessage.includes("end service")
  ) {
    let response = "I can help you stop your utility service.\n\n";
    response += "**To Process Your Request:**\n";
    response += "• Service end date\n";
    response += "• Forwarding address for final bill\n\n";
    response += "**Important Notes:**\n";
    response += "• 3 business days notice recommended\n";
    response += "• Final bill includes all charges through end date\n";
    response += "• Any deposit credit will be applied or refunded\n\n";
    response += "When would you like to stop service?";
    return response;
  }

  // Bill Payment
  if (
    lowerMessage.includes("pay bill") ||
    lowerMessage.includes("make payment") ||
    lowerMessage.includes("payment options") ||
    lowerMessage.includes("how to pay")
  ) {
    let response = "Here are your payment options:\n\n";
    response += "**Online (Easiest):**\n";
    response += "• Website or mobile app - instant, no fee\n";
    response += "• Auto-pay saves $2/month\n\n";
    response += "**Other Options:**\n";
    response += "• Phone: 1-800-PAY-UTIL ($2.50 fee)\n";
    response += "• Mail: Check or money order (5-7 days)\n";
    response += "• In person: Grocery stores and pharmacies\n\n";
    response += "Would you like to make a payment now, or set up auto-pay?";
    return response;
  }

  // Due Date
  if (
    lowerMessage.includes("due date") ||
    lowerMessage.includes("when is my bill due") ||
    lowerMessage.includes("payment due")
  ) {
    let response = "Bills are due 21 days after the statement date.\n\n";
    response += "**Helpful Options:**\n";
    response += "• Set up auto-pay to never miss a due date\n";
    response += "• Get text or email reminders\n";
    response += "• Request a one-time extension (up to 10 days)\n\n";
    response += "I can look up your specific due date. What's your account number or service address?";
    return response;
  }

  // Meter Questions
  if (
    lowerMessage.includes("meter") ||
    lowerMessage.includes("smart meter") ||
    lowerMessage.includes("meter reading")
  ) {
    let response = "Here's information about your meter:\n\n";
    response += "**Smart Meter Benefits:**\n";
    response += "• Automatic daily readings (no estimates)\n";
    response += "• View hourly usage online\n";
    response += "• Set high-usage alerts\n";
    response += "• Faster outage detection\n\n";
    response += "**Common Questions:**\n";
    response += "• Free meter accuracy testing available\n";
    response += "• Opt-out option: $75 fee + $25/mo\n\n";
    response += "What would you like to know about your meter?";
    return response;
  }

  // Rebates/Efficiency
  if (
    lowerMessage.includes("rebate") ||
    lowerMessage.includes("energy") ||
    lowerMessage.includes("save money") ||
    lowerMessage.includes("efficiency") ||
    lowerMessage.includes("audit")
  ) {
    let response = "Great question! We have several programs to help you save:\n\n";
    response += "**Popular Rebates:**\n";
    response += "• Smart thermostat: $50\n";
    response += "• ENERGY STAR refrigerator: $75\n";
    response += "• Heat pump: $500-800\n";
    response += "• Free LED bulb kit (up to 20 bulbs)\n\n";
    response += "**Free Services:**\n";
    response += "• Home energy audit (worth $200)\n";
    response += "• Usage analysis and recommendations\n\n";
    response += "Would you like to schedule a free energy audit or learn more about rebates?";
    return response;
  }

  // Reconnection
  if (
    lowerMessage.includes("reconnect") ||
    lowerMessage.includes("turn back on") ||
    lowerMessage.includes("service off") ||
    lowerMessage.includes("disconnected")
  ) {
    let response = "I can help you restore your service.\n\n";
    response += "**To Reconnect:**\n";
    response += "• Pay past-due balance, OR\n";
    response += "• Set up a payment arrangement\n\n";
    response += "**Fees:**\n";
    response += "• Standard reconnection: $50\n";
    response += "• Same-day (if paid by 3 PM): $100\n\n";
    response += "**Timeline:** Service typically restored within 24 hours.\n\n";
    response += "Would you like to discuss payment options to get your service restored?";
    return response;
  }

  // If we found relevant articles, use them
  if (articles.length > 0 && articles[0].similarity > 0.6) {
    const topArticle = articles[0];
    return `Based on your question, here's some helpful information:\n\n**${topArticle.title}**\n\n${topArticle.content}\n\nIs there anything else I can help you with?`;
  }

  // Default utility response
  return "Thank you for contacting utility customer service. I can help you with:\n\n" +
    "• **Billing** - View bills, payment options, high bill concerns\n" +
    "• **Outages** - Report or check on power outages\n" +
    "• **Service** - Start, stop, or transfer service\n" +
    "• **Payments** - Payment plans, assistance programs\n" +
    "• **Efficiency** - Rebates, energy audits, savings tips\n\n" +
    "How can I assist you today?";
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
}
