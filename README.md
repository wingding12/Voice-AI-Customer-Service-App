# Senpilot Customer Service Platform

A sophisticated Human-in-the-Loop (HITL) customer service platform featuring AI Voice Agent and Copilot Assistant.

## Features

- 🤖 **AI Voice Agent** - Powered by Retell AI for low-latency voice conversations
- 👤 **Copilot Assistant** - Real-time suggestions for human representatives
- 🔄 **Seamless Switching** - Toggle between AI and human without dropping calls
- 💬 **Multi-Channel** - Support for both voice calls and text chat
- 📊 **Diagnostics** - Track switch events and conversation analytics

## Tech Stack

| Component     | Technology                     |
| ------------- | ------------------------------ |
| Backend       | Node.js + Express + TypeScript |
| Frontend      | React + Vite + TypeScript      |
| Database      | PostgreSQL + pgvector          |
| Cache         | Redis                          |
| Telephony     | Telnyx                         |
| Voice AI      | Retell AI                      |
| Transcription | AssemblyAI                     |
| Real-time     | Socket.io                      |

## Project Structure

```
├── apps/
│   ├── backend/          # Node.js API server
│   └── web-client/       # React frontend
├── packages/
│   ├── database/         # Prisma ORM & migrations
│   └── shared-types/     # Shared TypeScript interfaces
├── docker-compose.yml    # Local dev services
└── package.json          # npm workspaces config
```

## Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose

## Getting Started

### 1. Clone and Install

```bash
git clone <repo-url>
cd customer-service-platform
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your API keys (optional for Phase 0)
```

### 3. Start Local Services

```bash
# Start Docker Desktop first, then:
npm run docker:up

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### 4. Run Development Servers

```bash
# Start both backend and frontend
npm run dev

# Or run separately:
npm run dev:backend  # http://localhost:3001
npm run dev:web      # http://localhost:5173
```

## API Endpoints

| Endpoint           | Method | Description              |
| ------------------ | ------ | ------------------------ |
| `/health`          | GET    | Health check             |
| `/api/call`        | POST   | Handle incoming calls    |
| `/api/chat`        | POST   | Handle chat messages     |
| `/api/switch`      | POST   | Toggle AI/Human mode     |
| `/webhooks/telnyx` | POST   | Telnyx call events       |
| `/webhooks/retell` | POST   | Retell transcript events |

## Environment Variables

See `.env.example` for all required variables:

**Required:**

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

**Optional (for full features):**

- `TELNYX_API_KEY` - Telnyx API credentials
- `RETELL_API_KEY` - Retell AI API key
- `ASSEMBLYAI_API_KEY` - AssemblyAI API key
- `OPENAI_API_KEY` - OpenAI API key (for embeddings)

## Development

### Commands

```bash
npm run dev           # Start all services
npm run build         # Build all packages
npm run db:studio     # Open Prisma Studio
npm run docker:down   # Stop Docker services
npm run clean         # Remove node_modules
```

### Testing Switches

During a call:

- **Voice**: Say "I want to speak to a human" or press `0`
- **Chat**: Type `/human` or "speak to agent"

To switch back:

- **Voice**: Say "Go back to the AI" or press `*`
- **Chat**: Type `/ai` or "back to bot"

## Architecture

```
Customer Call → Telnyx → Retell AI (Voice Agent)
                    ↘
                     Your Backend (Node.js)
                         ├── AssemblyAI (Transcription)
                         ├── pgvector (Customer Lookup)
                         └── Socket.io → Frontend (Copilot Sidebar)
```

## License

MIT
