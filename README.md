Voice AI Customer Service Platform

> **Next-Generation Customer Support**: Intelligent AI agents that seamlessly collaborate with human representatives to deliver exceptional customer experiences at scale.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)



##  **Key Features**

<table>
<tr>
<td width="50%">

### 🤖 **AI Voice Agent**

- **Ultra-low latency**: <500ms response time
- **Natural conversations**: Handles interruptions naturally
- **Specialized knowledge**: Utility industry expert
- **Emergency detection**: Auto-escalates critical issues
- Powered by **Retell AI** (STT + LLM + TTS unified)

</td>
<td width="50%">

###  **AI Text Chat**

- **Context-aware responses** using Gemini LLM
- **Knowledge base integration** via RAG pipeline
- **Multi-turn conversations** with full history
- **Dynamic switching** to human agents
- Unified experience across voice and text

</td>
</tr>
<tr>
<td width="50%">

###  **AI Copilot for Agents**

- **Real-time suggestions** as conversations flow
- **Sentiment analysis** detects customer frustration
- **Policy snippets** for instant reference
- **Knowledge search** across documentation
- Powered by **Google Gemini** with pgvector search

</td>
<td width="50%">

### 🔄 **Seamless AI↔Human Switching**

- **Conference Bridge pattern**: No call drops
- **One-click handoff** in agent dashboard
- **Customer-initiated**: "I want to speak to a human"
- **Agent-initiated**: Take over complex cases
- **Full context preservation** across all transitions

</td>
</tr>
</table>

###  **Enterprise Analytics**

- Real-time dashboard with live metrics
- Switch tracking and resolution analytics
- Performance monitoring and SLA tracking
- Complete audit trail of all interactions
- Socket.io powered real-time updates

---

##  **Architecture**

### **Technology Stack**

<table>
<tr>
<td><strong>Backend</strong></td>
<td>Node.js, Express, TypeScript</td>
</tr>
<tr>
<td><strong>Frontend</strong></td>
<td>React 18, Vite, TypeScript</td>
</tr>
<tr>
<td><strong>Database</strong></td>
<td>PostgreSQL + pgvector (vector embeddings)</td>
</tr>
<tr>
<td><strong>Cache</strong></td>
<td>Redis (sessions + real-time state)</td>
</tr>
<tr>
<td><strong>ORM</strong></td>
<td>Prisma (type-safe database access)</td>
</tr>
<tr>
<td><strong>Real-time</strong></td>
<td>Socket.io (WebSocket communication)</td>
</tr>
<tr>
<td><strong>AI Services</strong></td>
<td>Retell AI (voice), Google Gemini (chat/copilot)</td>
</tr>
<tr>
<td><strong>Telephony</strong></td>
<td>Telnyx (phone network integration)</td>
</tr>
<tr>
<td><strong>Embeddings</strong></td>
<td>OpenAI (RAG knowledge base)</td>
</tr>
</table>

### **High-Level System Architecture**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER LAYER                               │
│                    (Voice Calls + Text Chat)                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌──────────────────┐           ┌──────────────────┐
    │  VOICE CHANNEL   │           │   TEXT CHANNEL   │
    │                  │           │                  │
    │  Telnyx Phone    │           │  Chat Widget     │
    │  Retell AI STT   │           │  Gemini LLM      │
    │  Retell AI TTS   │           │  Context Memory  │
    └────────┬─────────┘           └────────┬─────────┘
             │                              │
             └──────────────┬───────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    BACKEND CORE          │
              │    (Node.js + Express)   │
              │                          │
              │  • Session Manager       │
              │  • Switch Controller     │
              │  • Copilot Engine        │
              │  • RAG Knowledge Base    │
              │  • Analytics Engine      │
              │  • Webhook Handlers      │
              └─────────┬────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │PostgreSQL│  │  Redis   │  │Socket.io │
    │+pgvector │  │ Sessions │  │Real-time │
    └──────────┘  └──────────┘  └─────┬────┘
                                      │
                                      ▼
                        ┌──────────────────────────┐
                        │   AGENT DASHBOARD        │
                        │      (React SPA)         │
                        │                          │
                        │  • Live Transcript View  │
                        │  • AI Copilot Sidebar    │
                        │  • Queue Management      │
                        │  • Control Panel         │
                        │  • Analytics Dashboard   │
                        └──────────────────────────┘
```

### **The Conference Bridge Pattern**

The approach to seamless handoffs:

```
┌─────────────────────────────────────────────────────────────┐
│                    CONFERENCE ROOM                          │
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│   │ CUSTOMER │    │ AI AGENT │    │  HUMAN   │            │
│   │          │    │          │    │   REP    │            │
│   │ Always   │    │ Muted/   │    │ Muted/   │            │
│   │ Active   │    │ Unmuted  │    │ Unmuted  │            │
│   └──────────┘    └──────────┘    └──────────┘            │
│                                                             │
│   SWITCH = Mute one participant, Unmute another            │
│   RESULT = Zero call drops, full context preserved         │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**

-  No call reconnection required
-  No context loss during handoff
-  Sub-second switching time
-  Customer doesn't hear any interruption
-  Scalable to multiple agents per call

---

## 🚀 **Getting Started**

### **Prerequisites**

- **Node.js** 18+ and **npm** 9+
- **Docker Desktop** (optional - for PostgreSQL + Redis)
- **API Keys** (see Environment Variables section)

### **Quick Start (3 minutes)**

```bash
# 1. Clone the repository
git clone <repository-url>
cd Senpilot-Customer-Service-App

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your API keys (see below)

# 4. Start the development servers
npm run dev
```

The app will start with:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3001
- **Storage**: In-memory (works without Docker)

### **With Docker (Recommended for Full Features)**

For persistent data storage and full analytics:

```bash
# Start PostgreSQL + Redis containers
docker-compose up -d

# Initialize the database
npm run db:generate
cd packages/database
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
npx prisma migrate dev --name init
npx tsx src/seed.ts
cd ../..

# Start the app
npm run dev
```

### **Access the Platform**

| URL                                                            | Description                  |
| -------------------------------------------------------------- | ---------------------------- |
| [`http://localhost:5173`](http://localhost:5173)               | Customer Demo (Chat + Voice) |
| [`http://localhost:5173/agent`](http://localhost:5173/agent)   | Agent Dashboard              |
| [`http://localhost:3001/health`](http://localhost:3001/health) | Backend Health Check         |

### **Demo Scenarios**

The platform includes 3 pre-built demo scenarios to showcase different use cases:

| Scenario                 | Description                                        |
| ------------------------ | -------------------------------------------------- |
| 💰 **High Bill Dispute** | Customer frustrated about unexpectedly high bill   |
| 🚨 **Report Gas Leak**   | Emergency situation requiring immediate escalation |
| 🏠 **Setup New Service** | New customer requesting service activation         |

Click any scenario button in the Chat or Voice interface to start a pre-configured conversation.

---

## ⚙️ **Configuration**

### **Environment Variables**

Create a `.env` file in the project root. Copy from `.env.example` and fill in your values:

```env
# ═══════════════════════════════════════════════════════════
# MINIMAL SETUP (Works without Docker)
# ═══════════════════════════════════════════════════════════

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (Required - but app falls back to in-memory if unavailable)
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/customer_service?schema=public"
REDIS_URL="redis://localhost:6379"

# ═══════════════════════════════════════════════════════════
# AI SERVICES (Add these for full functionality)
# ═══════════════════════════════════════════════════════════

# Google Gemini - Powers text chat + AI copilot
# Get key at: https://makersuite.google.com/
GEMINI_API_KEY=your_gemini_api_key

# Retell AI - Powers voice calls
# Get key at: https://retellai.com
RETELL_API_KEY=your_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id

# ═══════════════════════════════════════════════════════════
# OPTIONAL SERVICES (Enhanced features)
# ═══════════════════════════════════════════════════════════

# Telnyx - Phone number integration
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_CONNECTION_ID=your_connection_id
TELNYX_PHONE_NUMBER=+1234567890

# OpenAI - For RAG embeddings
OPENAI_API_KEY=your_openai_api_key

# Webhooks - For production deployments
WEBHOOK_BASE_URL=https://your-domain.com
```

### **Setting Up AI Services**

<details>
<summary><strong>🎙️ Retell AI (Voice Agent)</strong></summary>

1. Sign up at [retellai.com](https://retellai.com)
2. Create a new agent in the dashboard
3. Configure the agent:
   - Model: `gpt-4o-mini` or `gpt-4`
   - Voice: Select from 11labs voices
   - System prompt: Use utility customer service context
4. Copy your API key and Agent ID to `.env`

**Utility Voice Agent Setup:**

```bash
# Use our automated setup script
curl -X POST http://localhost:3001/api/voice/agent/create-llm

# This creates an LLM with:
# - Utility-specialized system prompt
# - Emergency gas leak detection
# - Billing/outage/payment knowledge
# - Natural conversation flow
```

</details>

<details>
<summary><strong>💬 Google Gemini (Text Chat + Copilot)</strong></summary>

1. Get API key from [Google AI Studio](https://makersuite.google.com/)
2. Add to `.env`: `GEMINI_API_KEY=your_key`
3. The platform automatically uses Gemini for:
   - Text chat responses (same personality as voice)
   - Agent copilot suggestions
   - Sentiment analysis
   - Context-aware recommendations

**No additional setup required** - it works out of the box!

</details>

<details>
<summary><strong> Telnyx (Optional - Phone Integration)</strong></summary>

1. Sign up at [telnyx.com](https://telnyx.com)
2. Purchase a phone number
3. Create a TeXML application
4. Set webhook URL: `https://your-domain/webhooks/telnyx`
5. Assign phone number to application
6. Add credentials to `.env`

_Note: Phone integration is optional. Voice calls also work via browser WebRTC._

</details>

---

##  **Project Structure**

```
customer-service-app/
├── apps/
│   ├── backend/                      # Node.js API Server
│   │   └── src/
│   │       ├── controllers/          # HTTP endpoints & webhooks
│   │       │   ├── chatController.ts       # Text chat API
│   │       │   ├── voiceController.ts      # Voice call management
│   │       │   ├── switchController.ts     # AI↔Human switching
│   │       │   ├── retellController.ts     # Retell webhooks
│   │       │   └── analyticsController.ts  # Metrics & diagnostics
│   │       ├── services/
│   │       │   ├── chat/             # Chat message processing
│   │       │   ├── voice/            # Voice call handling
│   │       │   ├── ai/               # Gemini LLM integration
│   │       │   ├── copilot/          # AI copilot engine
│   │       │   ├── state/            # Redis session management
│   │       │   └── analytics/        # Metrics aggregation
│   │       ├── sockets/
│   │       │   └── agentGateway.ts   # Socket.io real-time events
│   │       └── server.ts             # Express + Socket.io server
│   │
│   └── web-client/                   # React Frontend
│       └── src/
│           ├── components/
│           │   ├── agent-dashboard/  # Agent UI components
│           │   │   ├── QueuePanel.tsx         # Incoming requests queue
│           │   │   ├── LiveTranscript.tsx     # Real-time conversation
│           │   │   ├── SidebarCopilot.tsx     # AI suggestions panel
│           │   │   ├── ChatReplyInput.tsx     # Agent message input
│           │   │   └── ControlPanel.tsx       # Switch/mute controls
│           │   ├── customer-widget/  # Customer-facing UI
│           │   │   ├── ChatWindow.tsx         # Text chat interface
│           │   │   └── CallButton.tsx         # Voice call button
│           │   └── shared/           # Reusable components
│           ├── hooks/
│           │   ├── useCallState.ts            # Call state + Socket.io
│           │   ├── useAgentQueue.ts           # Queue management
│           │   └── useChatSocket.ts           # Chat real-time sync
│           └── pages/
│               ├── AgentPortal.tsx            # Main agent dashboard
│               └── CustomerDemo.tsx           # Customer demo page
│
├── packages/
│   ├── database/                     # Prisma ORM
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Database models
│   │   └── src/
│   │       ├── index.ts              # Prisma client
│   │       └── seed.ts               # Test data seeder
│   │
│   └── shared-types/                 # TypeScript Interfaces
│       └── src/
│           └── index.ts              # Shared types across apps
│
├── docker-compose.yml                # PostgreSQL + Redis
├── package.json                      # Monorepo workspace config
└── .env                              # Environment variables
```

---

##  **User Interface**

### **Agent Dashboard**

The command center for human representatives:

- ** Queue Panel** (Left): Live incoming requests with alerts
- ** Transcript View** (Center): Real-time conversation display
- ** Copilot Panel** (Right): AI suggestions and knowledge search
- ** Control Panel** (Bottom): Switch to/from AI, mute, hold, end
- ** Metrics Footer**: Active calls, resolution times, performance

### **Customer Widget**

Dual-channel customer interface:

- **Text Chat**: Instant messaging with AI/human agents
- **Voice Call**: Browser-based WebRTC voice calls
- **Seamless Mode Switching**: Toggle between chat and voice
- **Status Indicators**: AI vs Human agent, connection status

---

##  **API Reference**

### **Core Endpoints**

| Endpoint                   | Method | Description                      |
| -------------------------- | ------ | -------------------------------- |
| `/health`                  | GET    | Health check with service status |
| `/api/chat`                | POST   | Send customer chat message       |
| `/api/chat/respond`        | POST   | Human agent response             |
| `/api/chat/switch`         | POST   | Switch between AI and human      |
| `/api/voice/web-call`      | POST   | Create browser-based voice call  |
| `/api/voice/agent`         | GET    | Get voice agent configuration    |
| `/api/switch`              | POST   | AI↔Human handoff for voice       |
| `/api/analytics/dashboard` | GET    | Live dashboard metrics           |
| `/api/analytics/switches`  | GET    | Switch analytics by timeframe    |
| `/api/copilot/search`      | POST   | Search knowledge base            |

### **Socket.io Events**

**Client → Server:**

- `agent:join` - Agent joins their room
- `call:join` - Subscribe to call updates
- `call:request_switch` - Request AI↔Human switch
- `chat:send_message` - Agent sends chat message
- `queue:subscribe` - Subscribe to queue updates
- `metrics:subscribe` - Subscribe to live metrics

**Server → Client:**

- `transcript:update` - New message in conversation
- `copilot:suggestion` - AI suggestion for agent
- `call:state_update` - Call mode changed
- `queue:add` - New request in queue
- `queue:update` - Queue item updated
- `metrics:update` - Dashboard metrics refresh

---

##  **Analytics & Monitoring**

### **Real-time Metrics**

The platform tracks comprehensive analytics:

```json
{
  "overview": {
    "totalCalls": 1547,
    "activeCalls": 12,
    "avgDuration": 245,
    "totalSwitches": 289
  },
  "today": {
    "calls": 87,
    "switches": 23,
    "avgDuration": 198
  },
  "modeDistribution": {
    "aiResolved": 1094, // 70.8% AI resolution
    "humanResolved": 312, // 20.2% human only
    "mixed": 141 // 9.1% both
  },
  "switchMetrics": {
    "avgSwitchTime": 1.2, // Seconds
    "topReasons": {
      "CUSTOMER_REQUEST": 152,
      "COMPLEXITY": 89,
      "ESCALATION": 48
    }
  }
}
```

### **Performance Monitoring**

- Average handle time (AHT)
- First response time (FRT)
- Resolution rate by channel
- Agent utilization
- Customer satisfaction proxy metrics
- Emergency detection accuracy

---

##  **Testing**

### **Test Scenarios**

| Scenario         | Channel | Steps                                               |
| ---------------- | ------- | --------------------------------------------------- |
| **Happy Path**   | Voice   | Customer inquiry → AI resolves → Call ends          |
| **Escalation**   | Voice   | Customer requests human → Switch → Human resolves   |
| **Emergency**    | Voice   | Gas leak mentioned → Auto-escalate → Emergency team |
| **Text Chat**    | Chat    | Customer asks question → AI responds → Follow-up    |
| **Multi-switch** | Both    | AI → Human → AI → Human (stress test)               |

### **Running Tests**

```bash
# Backend API tests
cd apps/backend
npm test

# Frontend component tests
cd apps/web-client
npm test

# E2E tests (full flow)
npm run test:e2e
```

---

##  **Use Cases**

### **1. Utility Companies** (Primary)

Our specialized domain with pre-built knowledge:

-  **Billing inquiries**: Explain charges, rate tiers, high bills
-  **Payment support**: Set up payment plans, financial hardship
-  **Outage reporting**: Status updates, estimated restoration
-  **Service changes**: Start/stop/transfer service
-  **Emergency response**: Gas leak detection and escalation

**ROI**: 70% AI resolution rate = ~$3M annual savings for 100-agent call center

### **2. E-Commerce**

- Order tracking and status updates
- Returns and refund processing
- Product recommendations
- VIP customer prioritization
- Inventory and shipping inquiries

### **3. Healthcare**

- Appointment scheduling and reminders
- Insurance verification
- Prescription refills
- General health information (non-diagnosis)
- HIPAA-compliant audit trails

### **4. Financial Services**

- Account balance and transaction inquiries
- Fraud detection and reporting
- Loan/mortgage application support
- Investment guidance escalation
- Compliance-ready conversation logs

---

##  **Security & Compliance**

### **Data Protection**

- All API calls encrypted with TLS 1.3
- Database encryption at rest
- Redis session data encrypted
- PII data masked in logs

### **Audit & Compliance**

- Complete conversation transcripts stored
- Switch events logged with timestamps
- Agent actions tracked
- GDPR data deletion support
- Configurable data retention policies

### **Access Control**

- Agent authentication (planned)
- Role-based access control (planned)
- API key rotation support
- Rate limiting on public endpoints

---

##  **Development**

### **Troubleshooting**

<details>
<summary><strong> Redis connection refused</strong></summary>

The app automatically falls back to in-memory storage. You'll see:

```
  Redis unavailable - using in-memory storage
   (Start Redis with: docker-compose up -d)
```

For persistent sessions, start Docker:

```bash
docker-compose up -d
```

</details>

<details>
<summary><strong> Database connection failed</strong></summary>

If you see Prisma errors about database connection:

1. **Option A**: Start Docker for full database support:
   ```bash
   docker-compose up -d
   npm run db:generate
   ```
2. **Option B**: Continue without database (analytics will show mock data)
</details>

<details>
<summary><strong> Voice calls not working</strong></summary>

Voice calls require Retell AI configuration:

1. Sign up at [retellai.com](https://retellai.com)
2. Create a voice agent
3. Add to `.env`:
   ```
   RETELL_API_KEY=your_key
   RETELL_AGENT_ID=your_agent_id
   ```
4. Restart the server
</details>

<details>
<summary><strong> Text chat shows basic responses</strong></summary>

For AI-powered responses, add your Gemini API key:

1. Get key from [Google AI Studio](https://makersuite.google.com/)
2. Add to `.env`: `GEMINI_API_KEY=your_key`
3. Restart the server
</details>

<details>
<summary><strong> Port already in use</strong></summary>

Kill existing processes:

```bash
# Kill backend (port 3001)
lsof -ti:3001 | xargs kill -9

# Kill frontend (port 5173)
lsof -ti:5173 | xargs kill -9

# Restart
npm run dev
```

</details>


##  **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

##  **Acknowledgments**

- [Retell AI](https://retellai.com) - Voice AI platform
- [Google Gemini](https://ai.google.dev) - LLM for chat & copilot
- [Telnyx](https://telnyx.com) - Telephony infrastructure
- [OpenAI](https://openai.com) - Embeddings for RAG
- [Prisma](https://prisma.io) - Next-gen ORM


<div align="center">


</div>
