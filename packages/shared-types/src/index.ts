// ===========================================
// Shared Types for Customer Service Platform
// ===========================================

// -----------------------------
// Call & Session Types
// -----------------------------

export type CallMode = 'AI_AGENT' | 'HUMAN_REP';
export type SpeakerType = 'AI' | 'HUMAN' | 'CUSTOMER';
export type CallStatus = 'ringing' | 'active' | 'on_hold' | 'ended';

export interface CallSession {
  callId: string;
  customerId: string | null;
  mode: CallMode;
  status: CallStatus;
  startTime: number;
  transcript: TranscriptEntry[];
  switchCount: number;
  metadata: Record<string, unknown>;
}

export interface TranscriptEntry {
  speaker: SpeakerType;
  text: string;
  timestamp: number;
}

// -----------------------------
// WebSocket Event Types
// -----------------------------

export interface CallStateUpdate {
  callId: string;
  activeSpeaker: SpeakerType;
  isMuted: boolean;
  mode: CallMode;
  startTime?: number; // Backend's authoritative start time (for duration sync)
}

export interface SwitchEvent {
  callId: string;
  direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI';
  timestamp: number;
  reason?: string;
}

// -----------------------------
// Copilot Types
// -----------------------------

export type SuggestionType = 'INFO' | 'ACTION';

export interface CopilotSuggestion {
  type: SuggestionType;
  title: string;
  content: string;
  confidenceScore: number;
  metadata?: {
    customerId?: string;
    orderId?: string;
    policyId?: string;
    [key: string]: unknown;
  };
}

export interface IntentDetection {
  intent: string;
  confidence: number;
  entities: Record<string, string>;
}

// -----------------------------
// Customer Types
// -----------------------------

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Order {
  id: string;
  customerId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  items: OrderItem[];
  createdAt: Date;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

// -----------------------------
// API Request/Response Types
// -----------------------------

export interface ChatRequest {
  message: string;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  suggestions?: CopilotSuggestion[];
}

export interface SwitchRequest {
  callId: string;
  direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI';
  reason?: string;
}

export interface SwitchResponse {
  success: boolean;
  newMode: CallMode;
  timestamp: number;
}

// -----------------------------
// Webhook Payload Types
// -----------------------------

export interface TelnyxCallWebhook {
  data: {
    event_type: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      from: string;
      to: string;
      direction: 'incoming' | 'outgoing';
      state: string;
    };
  };
}

export interface RetellWebhook {
  event: string;
  call_id: string;
  transcript?: {
    role: 'agent' | 'user';
    content: string;
    timestamp: number;
  }[];
  call_analysis?: {
    sentiment: string;
    summary: string;
  };
}

// -----------------------------
// Database Model Types (Prisma-like)
// -----------------------------

export interface DBCall {
  id: string;
  customerId: string | null;
  mode: CallMode;
  status: CallStatus;
  transcript: string | null;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBSwitchLog {
  id: string;
  callId: string;
  direction: string;
  reason: string | null;
  switchedAt: Date;
}

