# Senpilot Customer Service Platform

A sophisticated **Human-in-the-Loop (HITL)** customer service platform featuring an AI Voice Agent and Copilot Assistant. The system uses a **Conference Bridge** architecture that allows seamless real-time switching between AI and human agents without dropping calls.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Socket.io Events](#socketio-events)
- [API Endpoints](#api-endpoints)
- [Development Phases](#development-phases)
- [Testing](#testing)
- [Commands Reference](#commands-reference)

---

## Features

| Feature                   | Description                                              | Status        |
| ------------------------- | -------------------------------------------------------- | ------------- |
| 🤖 **AI Voice Agent**     | Powered by Retell AI for low-latency voice conversations | ✅ Integrated |
| 👤 **Copilot Assistant**  | Real-time suggestions sidebar for human representatives  | ✅ Integrated |
| 🔄 **Seamless Switching** | Toggle between AI and human without dropping calls       | 🔜 Phase 7    |
| 💬 **Multi-Channel**      | Support for both voice calls and text chat               | 🔜 Phase 8    |
| 📊 **Diagnostics**        | Track switch events and conversation analytics           | 🔜 Phase 9    |
| 🎯 **Agent Dashboard**    | Real-time transcript, copilot suggestions, control panel | ✅ UI Ready   |
| 🗣️ **Customer Widget**    | Chat window and voice call button for customers          | ✅ UI Ready   |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER                                    │
│                    (Voice Call / Chat)                              │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │     TELNYX      │  ← Telephony Provider
                    │  (Phone Network) │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │   RETELL AI     │           │   YOUR BACKEND  │
    │  (Voice Agent)  │           │    (Node.js)    │
    │                 │           │                 │
    │ • STT → LLM → TTS│  webhook │ • AssemblyAI    │
    │ • Handles calls │ ────────► │ • pgvector RAG  │
    │ • Live transcript│          │ • Redis Sessions│
    └─────────────────┘           └────────┬────────┘
                                           │
                                           │ Socket.io
                                           ▼
                                  ┌─────────────────┐
                                  │    FRONTEND     │
                                  │ (React + Vite)  │
                                  │                 │
                                  │ • Agent Dashboard│
                                  │ • Customer Widget│
                                  └─────────────────┘
```

### The "Conference Bridge" Pattern

Instead of forwarding calls (which causes drops), we use a conference room where participants are muted/unmuted:

1. **Customer** calls in → placed in digital conference room
2. **AI Agent** joins immediately (speaking)
3. **Human Rep** joins same room (muted, listening)
4. **Switch**: Mute AI, unmute Human (or vice versa)
5. **Result**: No call drops, seamless handoff

---

## Tech Stack

| Layer             | Technology                     | Purpose                               |
| ----------------- | ------------------------------ | ------------------------------------- |
| **Backend**       | Node.js + Express + TypeScript | API server, webhook handlers          |
| **Frontend**      | React 18 + Vite + TypeScript   | Agent dashboard, customer widget      |
| **Database**      | PostgreSQL + pgvector          | Relational data + vector search       |
| **Cache**         | Redis                          | Session state, real-time call context |
| **ORM**           | Prisma                         | Type-safe database access             |
| **Real-time**     | Socket.io                      | Push updates to frontend              |
| **Telephony**     | Telnyx                         | Phone network, media streams          |
| **Voice AI**      | Retell AI                      | STT + LLM + TTS in one                |
| **Transcription** | AssemblyAI                     | Copilot transcript analysis           |
| **Embeddings**    | OpenAI                         | Vector embeddings for RAG             |

---

## Project Structure

```
Senpilot-Customer-Service-App/
├── apps/
│   ├── backend/                      # Node.js API Server
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   └── env.ts            # Environment validation (Zod)
│   │   │   ├── controllers/
│   │   │   │   ├── callController.ts    # Telnyx webhook handler
│   │   │   │   └── retellController.ts  # Retell AI webhook handler
│   │   │   ├── services/
│   │   │   │   ├── state/
│   │   │   │   │   └── sessionStore.ts   # Redis session management
│   │   │   │   ├── voice/
│   │   │   │   │   ├── telnyxClient.ts   # TeXML builder + Telnyx API
│   │   │   │   │   └── retellClient.ts   # Retell AI SDK wrapper
│   │   │   │   └── copilot/
│   │   │   │       ├── assemblyaiClient.ts  # Intent detection, sentiment
│   │   │   │       ├── ragService.ts        # pgvector knowledge search
│   │   │   │       └── copilotService.ts    # Main suggestion engine
│   │   │   ├── sockets/
│   │   │   │   └── agentGateway.ts   # Socket.io event handlers
│   │   │   ├── app.ts                # Express app setup
│   │   │   └── server.ts             # Entry point, Socket.io init
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web-client/                   # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── agent-dashboard/
│       │   │   │   ├── ActiveCallBanner.tsx    # AI/Human status display
│       │   │   │   ├── LiveTranscript.tsx      # Scrolling conversation
│       │   │   │   ├── SidebarCopilot.tsx      # Suggestion cards
│       │   │   │   └── ControlPanel.tsx        # Switch button + controls
│       │   │   ├── customer-widget/
│       │   │   │   ├── ChatWindow.tsx          # Text chat UI
│       │   │   │   └── CallButton.tsx          # Voice call UI
│       │   │   └── shared/
│       │   │       └── ConnectionStatus.tsx    # Socket connection indicator
│       │   ├── hooks/
│       │   │   ├── useSocket.ts                # Socket.io connection (standalone)
│       │   │   └── useCallState.ts             # Call state + socket (combined)
│       │   ├── pages/
│       │   │   ├── AgentPortal.tsx             # Human rep dashboard
│       │   │   └── CustomerDemo.tsx            # Customer-facing UI
│       │   ├── index.css                       # Global styles + CSS variables
│       │   ├── main.tsx                        # React entry point
│       │   ├── App.tsx                         # Router setup
│       │   └── vite-env.d.ts                   # TypeScript declarations
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── packages/
│   ├── database/                     # Prisma ORM
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Database models
│   │   ├── src/
│   │   │   ├── index.ts              # Prisma client singleton
│   │   │   └── seed.ts               # Test data seeder
│   │   └── package.json
│   │
│   └── shared-types/                 # TypeScript Interfaces
│       └── src/
│           └── index.ts              # All shared types
│
├── docker-compose.yml                # PostgreSQL + Redis
├── package.json                      # npm workspaces config
├── .env                              # Environment variables (git-ignored)
├── .env.example                      # Environment template
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** 9+
- **Docker Desktop** (for PostgreSQL + Redis)

### 1. Install Dependencies

```bash
git clone <repo-url>
cd Senpilot-Customer-Service-App
npm install
```

### 2. Start Docker Services

```bash
# Start PostgreSQL (port 5433) and Redis (port 6379)
npm run docker:up
```

> **Note**: We use port 5433 for PostgreSQL to avoid conflicts with local installations.

### 3. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` with your values. Minimum required:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Run migrations (creates tables)
cd packages/database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
npx prisma migrate dev --name init

# Seed test data
npx tsx src/seed.ts
```

### 5. Run Development Servers

```bash
# Backend (http://localhost:3001)
npm run dev:backend

# Frontend (http://localhost:5173)
npm run dev:web
```

### 6. Access the App

| URL                            | Description          |
| ------------------------------ | -------------------- |
| http://localhost:5173/agent    | Agent Dashboard      |
| http://localhost:5173/customer | Customer Widget      |
| http://localhost:3001/health   | Backend health check |

---

## Environment Variables

| Variable               | Required | Description                           |
| ---------------------- | -------- | ------------------------------------- |
| `DATABASE_URL`         | ✅       | PostgreSQL connection string          |
| `REDIS_URL`            | ✅       | Redis connection string               |
| `PORT`                 | ✅       | Backend server port (default: 3001)   |
| `NODE_ENV`             | ✅       | `development` / `production` / `test` |
| `FRONTEND_URL`         | ✅       | Frontend URL for CORS                 |
| `TELNYX_API_KEY`       | ❌       | Telnyx API key (Phase 3)              |
| `TELNYX_PUBLIC_KEY`    | ❌       | Telnyx public key                     |
| `TELNYX_CONNECTION_ID` | ❌       | Telnyx connection ID                  |
| `TELNYX_PHONE_NUMBER`  | ❌       | Your Telnyx phone number              |
| `RETELL_API_KEY`       | ❌       | Retell AI API key (Phase 4)           |
| `RETELL_AGENT_ID`      | ❌       | Retell agent ID                       |
| `ASSEMBLYAI_API_KEY`   | ❌       | AssemblyAI API key (Phase 5)          |
| `OPENAI_API_KEY`       | ❌       | OpenAI API key for embeddings         |
| `WEBHOOK_BASE_URL`     | ❌       | Public URL for webhooks (ngrok)       |

---

## Database Schema

### Models

```prisma
model Customer {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  phone     String?
  embedding vector(1536)?  // pgvector for semantic search
  calls     Call[]
  orders    Order[]
}

model Call {
  id         String     @id  // Telnyx Call SID
  customerId String?
  mode       CallMode   @default(AI_AGENT)  // AI_AGENT | HUMAN_REP
  status     CallStatus @default(ACTIVE)
  transcript Json?
  switchLogs SwitchLog[]
  startedAt  DateTime
  endedAt    DateTime?
}

model SwitchLog {
  id         String   @id @default(uuid())
  callId     String
  direction  String   // "AI_TO_HUMAN" | "HUMAN_TO_AI"
  reason     String?  // "CUSTOMER_REQUEST", "SENTIMENT_NEGATIVE", etc.
  switchedAt DateTime
}

model Order {
  id         String      @id @default(uuid())
  customerId String
  status     OrderStatus // PENDING | PROCESSING | SHIPPED | DELIVERED | CANCELLED
  total      Decimal
  items      Json
}

model KnowledgeArticle {
  id        String   @id @default(uuid())
  title     String
  content   String
  category  String
  embedding vector(1536)?  // For RAG search
}
```

### Seeded Test Data

- 3 customers (John Doe, Jane Smith, Bob Wilson)
- 3 orders with items
- 4 knowledge articles (Return Policy, Shipping, Refunds, Warranty)

---

## Socket.io Events

### Client → Server

| Event                 | Payload                 | Description                  |
| --------------------- | ----------------------- | ---------------------------- |
| `agent:join`          | `agentId: string`       | Agent joins their room       |
| `call:join`           | `callId: string`        | Join a call room for updates |
| `call:leave`          | `callId: string`        | Leave a call room            |
| `call:request_switch` | `{ callId, direction }` | Request AI↔Human switch      |

### Server → Client

| Event                | Payload                    | Description            |
| -------------------- | -------------------------- | ---------------------- |
| `call:state_update`  | `CallStateUpdate`          | Call state changed     |
| `transcript:update`  | `TranscriptEntry`          | New transcript entry   |
| `copilot:suggestion` | `CopilotSuggestion`        | New copilot suggestion |
| `call:switch`        | `{ direction, timestamp }` | Switch completed       |
| `call:end`           | —                          | Call ended             |

### TypeScript Types

```typescript
interface CallStateUpdate {
  callId: string;
  activeSpeaker: "AI" | "HUMAN" | "CUSTOMER";
  isMuted: boolean;
  mode: "AI_AGENT" | "HUMAN_REP";
}

interface TranscriptEntry {
  speaker: "AI" | "HUMAN" | "CUSTOMER";
  text: string;
  timestamp: number;
}

interface CopilotSuggestion {
  type: "INFO" | "ACTION";
  title: string;
  content: string;
  confidenceScore: number;
  metadata?: { customerId?; orderId?; policyId? };
}
```

---

## API Endpoints

| Endpoint                  | Method | Description              | Status         |
| ------------------------- | ------ | ------------------------ | -------------- |
| `/health`                 | GET    | Health check             | ✅ Implemented |
| `/webhooks/telnyx`        | POST   | Telnyx call events       | ✅ Implemented |
| `/webhooks/telnyx/gather` | POST   | DTMF digit collection    | ✅ Implemented |
| `/webhooks/retell`        | POST   | Retell transcript events | ✅ Implemented |
| `/api/chat`               | POST   | Handle chat messages     | 🔜 Phase 8     |
| `/api/switch`             | POST   | Toggle AI/Human mode     | 🔜 Phase 7     |

---

## Telnyx Webhooks

### Handled Events

| Event Type            | Action                                   |
| --------------------- | ---------------------------------------- |
| `call.initiated`      | Create call record, answer with greeting |
| `call.answered`       | Update status, notify frontend           |
| `call.dtmf.received`  | Handle `0` (human) or `*` (AI) switch    |
| `call.hangup`         | Cleanup session, update database         |
| `call.speak.ended`    | Acknowledgement only                     |
| `call.playback.ended` | Acknowledgement only                     |

### TeXML Responses

The backend responds to Telnyx webhooks with TeXML (XML-based call control):

```xml
<!-- Answer with greeting and DTMF gather -->
<Response>
  <Gather action="/webhooks/telnyx/gather" numDigits="1" timeout="5">
    <Say voice="alice">Welcome to Senpilot. Press 0 for human.</Say>
  </Gather>
</Response>

<!-- Simple speak -->
<Response>
  <Say voice="alice">Connecting you with a representative.</Say>
</Response>

<!-- Hangup -->
<Response>
  <Say voice="alice">Thank you for calling. Goodbye.</Say>
  <Hangup/>
</Response>
```

### Setting Up Telnyx

1. Create a [Telnyx account](https://telnyx.com)
2. Purchase a phone number
3. Create a TeXML Application with webhook URL: `https://your-domain.com/webhooks/telnyx`
4. Assign the phone number to the TeXML Application
5. Add credentials to `.env`:
   ```env
   TELNYX_API_KEY=your_api_key
   TELNYX_PUBLIC_KEY=your_public_key
   TELNYX_CONNECTION_ID=your_connection_id
   TELNYX_PHONE_NUMBER=+1234567890
   WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
   ```

---

## Retell AI Integration

Retell AI provides a complete voice AI solution (STT → LLM → TTS) in a single low-latency service.

### Retell Webhook Events

| Event           | Description                             |
| --------------- | --------------------------------------- |
| `call_started`  | AI call has begun                       |
| `call_ended`    | Call ended (includes full transcript)   |
| `call_analyzed` | Post-call analysis (sentiment, summary) |
| `transcript`    | Real-time transcript update during call |

### Retell Client Functions

| Function              | Purpose                                |
| --------------------- | -------------------------------------- |
| `registerPhoneCall()` | Register incoming call with Retell AI  |
| `createWebCall()`     | Create browser-based call (for widget) |
| `getCallDetails()`    | Retrieve call transcript and status    |
| `endCall()`           | Programmatically end a Retell call     |
| `listRecentCalls()`   | Debug helper to list recent calls      |

### Setting Up Retell

1. Create a [Retell AI account](https://retellai.com)
2. Create an Agent in the Retell dashboard
3. Configure the agent's:
   - LLM model and system prompt
   - Voice settings (TTS voice)
   - Webhook URL: `https://your-domain.com/webhooks/retell`
4. Add credentials to `.env`:
   ```env
   RETELL_API_KEY=your_api_key
   RETELL_AGENT_ID=your_agent_id
   ```

### Call Flow with Retell

```
Customer calls → Telnyx receives → Backend answers
                                       ↓
                              Register with Retell
                                       ↓
                        Retell AI handles conversation
                                       ↓
                     Live transcripts → Socket.io → Frontend
                                       ↓
                         Press 0 → Switch to Human Rep
```

---

## AssemblyAI Copilot Integration

AssemblyAI's LeMUR powers the Copilot's intelligence for real-time agent assistance.

### Copilot Functions

| Function                  | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `detectIntent()`          | Identify customer intent from transcript |
| `analyzeSentiment()`      | Detect frustration or positive sentiment |
| `summarizeConversation()` | Generate 2-3 sentence summary            |
| `extractActionItems()`    | Pull follow-up tasks from conversation   |

### Detected Intents

| Intent             | Description                    |
| ------------------ | ------------------------------ |
| `order_status`     | Customer checking order status |
| `refund_request`   | Customer requesting refund     |
| `product_question` | Questions about products       |
| `complaint`        | Customer complaint             |
| `general_inquiry`  | General questions              |

### Setting Up AssemblyAI

1. Create an [AssemblyAI account](https://assemblyai.com)
2. Get your API key from the dashboard
3. Add to `.env`:
   ```env
   ASSEMBLYAI_API_KEY=your_api_key
   ```

---

## RAG Knowledge Base (pgvector)

The Copilot uses semantic search to find relevant knowledge articles.

### RAG Functions

| Function                    | Purpose                              |
| --------------------------- | ------------------------------------ |
| `generateEmbedding()`       | Create 1536-dim vector from text     |
| `searchKnowledgeBase()`     | pgvector cosine similarity search    |
| `searchKnowledgeBaseText()` | Fallback text search (no embeddings) |
| `smartSearch()`             | Auto-select best search method       |
| `updateArticleEmbedding()`  | Update single article embedding      |
| `updateAllEmbeddings()`     | Bulk re-index all articles           |

### How It Works

```
Customer says: "How do I return my order?"
                    ↓
         generateEmbedding(query)
                    ↓
         pgvector similarity search
                    ↓
      ┌─────────────────────────────┐
      │ Return Policy (0.92)        │
      │ Refund Process (0.85)       │
      │ Shipping Info (0.71)        │
      └─────────────────────────────┘
                    ↓
         Copilot generates suggestion
```

### Setting Up OpenAI (for Embeddings)

1. Create an [OpenAI account](https://platform.openai.com)
2. Generate an API key
3. Add to `.env`:
   ```env
   OPENAI_API_KEY=your_api_key
   ```

### Initializing Embeddings

After seeding the database, run:

```typescript
import { updateAllEmbeddings } from "./services/copilot/ragService";
await updateAllEmbeddings();
```

---

## Copilot Suggestion Engine

The main service that ties intent detection and RAG together.

### Copilot Service Functions

| Function              | Purpose                                 |
| --------------------- | --------------------------------------- |
| `processTranscript()` | Analyze transcript and emit suggestions |
| `triggerSuggestion()` | Manually search and emit suggestion     |

### Suggestion Types

| Type     | Icon | Purpose                      |
| -------- | ---- | ---------------------------- |
| `INFO`   | 📚   | Knowledge/policy information |
| `ACTION` | 💡   | Recommended action for agent |

### How Suggestions Are Generated

```
Transcript Update
       ↓
┌──────────────────────────────┐
│ detectIntent() (AssemblyAI)  │
│ analyzeSentiment()           │
│ smartSearch() (pgvector)     │
└──────────────────────────────┘
       ↓
┌──────────────────────────────┐
│ Intent-specific suggestions: │
│ • order_status → Order info  │
│ • refund_request → Policy    │
│ • complaint → Escalation     │
└──────────────────────────────┘
       ↓
emitCopilotSuggestion() → Socket.io → Frontend
```

### Frustration Detection

When customer sentiment drops below threshold (-0.3), an automatic alert is sent:

```
⚠️ Customer Frustration Detected
The customer seems frustrated. Consider acknowledging
their concerns and offering a concrete solution.
```

---

## Development Phases

| Phase | Name               | Status      | Description                             |
| ----- | ------------------ | ----------- | --------------------------------------- |
| 0     | Foundation         | ✅ Complete | Monorepo, Docker, TypeScript setup      |
| 1     | Database Layer     | ✅ Complete | Prisma, pgvector, migrations, seeding   |
| 2     | Backend Skeleton   | ✅ Complete | Express, Socket.io, Redis, health check |
| 3     | Telephony - Telnyx | ✅ Complete | Incoming calls, webhooks, TeXML         |
| 4     | Voice AI - Retell  | ✅ Complete | Retell SDK, webhooks, live transcripts  |
| 5     | Copilot Brain      | ✅ Complete | AssemblyAI, pgvector RAG, suggestions   |
| 6     | Frontend Polish    | ⏳ Pending  | UI refinements, animations              |
| 7     | The Switch         | 🔜 Next     | Real-time AI↔Human handoff              |
| 8     | Text Chat          | ⏳ Pending  | Chat endpoint, unified messages         |
| 9     | Diagnostics        | ⏳ Pending  | Analytics, switch tracking              |

---

## Testing

### Switch Trigger Mechanisms

| Channel          | Switch to Human                   | Switch to AI                |
| ---------------- | --------------------------------- | --------------------------- |
| **Voice**        | Say "I want to speak to a human"  | Say "Go back to the AI"     |
| **Voice (DTMF)** | Press `0`                         | Press `*`                   |
| **Chat**         | Type `/human` or "speak to agent" | Type `/ai` or "back to bot" |

### Test Scripts Location

```
test-scripts/
├── voice/
│   ├── 01-happy-path-ai-resolves.md
│   ├── 02-escalation-to-human.md
│   └── 03-multiple-switches.md
├── chat/
│   └── ...
└── edge-cases/
    └── ...
```

---

## Commands Reference

```bash
# Development
npm run dev              # Start all services
npm run dev:backend      # Start backend only (port 3001)
npm run dev:web          # Start frontend only (port 5173)

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations
npm run db:seed          # Seed test data
npm run db:studio        # Open Prisma Studio

# Docker
npm run docker:up        # Start PostgreSQL + Redis
npm run docker:down      # Stop Docker services

# Utilities
npm run build            # Build all packages
npm run clean            # Remove node_modules
```

---

## Troubleshooting

### Port 5432 Already in Use

PostgreSQL is configured to use port **5433** to avoid conflicts. Ensure your `DATABASE_URL` uses the correct port:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
```

### Prisma Can't Find .env

Symlinks are created from `packages/database/.env` and `apps/backend/.env` to the root `.env`. If issues persist, run commands from the package directory with the env var exported:

```bash
cd packages/database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
npx prisma migrate dev
```

### Socket.io Not Connecting

Check that:

1. Backend is running on port 3001
2. Frontend Vite proxy is configured (see `vite.config.ts`)
3. `FRONTEND_URL` in `.env` matches frontend URL

---

## License

MIT
