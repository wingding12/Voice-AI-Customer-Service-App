# Senpilot
## AI-Powered Customer Service Platform

---

# 📋 Presentation Overview

1. Project Summary
2. Technology Stack
3. Architecture & Design
4. Key Features
5. Use Cases
6. Benefits
7. Live Demo
8. Future Roadmap

---

# 1️⃣ Project Summary

## What is Senpilot?

**Senpilot** is an intelligent customer service platform that combines:

- 🤖 **AI Voice Agent** — Handles customer calls with natural conversation
- 👤 **AI Copilot** — Assists human representatives in real-time
- 🔄 **Seamless Switching** — Toggle between AI and human without dropping calls

### The Problem We Solve

Traditional customer service systems force a choice:
- **Pure AI**: Fast but impersonal, can't handle complex issues
- **Pure Human**: Personal but expensive, long wait times

### Our Solution: Human-in-the-Loop (HITL)

Senpilot bridges both worlds:
- AI handles routine inquiries instantly
- Humans step in for complex cases with full context
- Switch happens **in real-time** without interruption

---

# 2️⃣ Technology Stack

## Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | API server, webhook handlers |
| **TypeScript** | Type-safe development |
| **PostgreSQL + pgvector** | Data storage + vector search |
| **Redis** | Session state, real-time context |
| **Prisma ORM** | Type-safe database access |

## Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI components |
| **Vite** | Fast development & bundling |
| **Socket.io** | Real-time updates |
| **TypeScript** | Type safety |

## AI & Voice Services
| Service | Purpose |
|---------|---------|
| **Retell AI** | Voice agent (STT + LLM + TTS) |
| **Google Gemini** | Text chat AI + Copilot |
| **Telnyx** | Phone network & telephony |
| **OpenAI** | Vector embeddings (RAG) |

---

# 3️⃣ Architecture & Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CUSTOMER                                │
│                 (Phone / Browser Chat)                       │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │   VOICE CALL    │         │   TEXT CHAT     │
    │   (Telnyx +     │         │   (Gemini AI)   │
    │   Retell AI)    │         │                 │
    └────────┬────────┘         └────────┬────────┘
             │                           │
             └───────────┬───────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    UNIFIED BACKEND   │
              │      (Node.js)       │
              │                      │
              │  • Session Manager   │
              │  • Copilot Engine    │
              │  • Switch Controller │
              │  • Analytics         │
              └──────────┬───────────┘
                         │
            ┌────────────┴────────────┐
            │       Socket.io         │
            └────────────┬────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   AGENT DASHBOARD    │
              │      (React)         │
              │                      │
              │  • Live Transcript   │
              │  • Copilot Sidebar   │
              │  • Control Panel     │
              │  • Queue Management  │
              └─────────────────────┘
```

## The Conference Bridge Pattern

**The Secret to Seamless Switching**

Traditional call forwarding = drops the call

Our approach:
1. Customer joins a **digital conference room**
2. AI Agent joins (speaking)
3. Human Rep joins (muted, listening)
4. **Switch = Mute/Unmute** — No reconnection needed!

Result: Zero interruption, full context preserved

---

# 4️⃣ Key Features

## 🤖 AI Voice Agent (Retell AI)

- **Ultra-low latency** (<500ms response time)
- **Natural conversation** — Handles interruptions, backchannels
- **Utility-focused** — Trained on billing, outages, payments
- **Emergency detection** — Gas leaks trigger immediate escalation

## 💬 AI Text Chat (Gemini)

- **Context-aware responses** — Remembers conversation history
- **Knowledge base integration** — RAG-powered answers
- **Dynamic switching** — Customer can request human anytime
- **Multi-turn conversations** — Handles complex inquiries

## 👤 AI Copilot

- **Real-time suggestions** — Appears as conversation progresses
- **Sentiment detection** — Alerts when customer is frustrated
- **Policy snippets** — Quick reference for reps
- **Knowledge search** — Find answers in seconds

## 🔄 Seamless Switching

- **One-click handoff** — AI ↔ Human instantly
- **Context preserved** — Full transcript shared
- **Customer-initiated** — Say "speak to human"
- **Agent-initiated** — Take over complex cases

## 📊 Analytics Dashboard

- **Live metrics** — Active calls, queue depth
- **Switch tracking** — AI vs Human resolution rates
- **Performance** — Average handle time, CSAT
- **Real-time updates** — via Socket.io

---

# 5️⃣ Use Cases

## 🏢 Utility Companies

**Primary Use Case: Senpilot is specialized for utility customer service**

| Scenario | AI Handles | Human Handles |
|----------|-----------|---------------|
| Bill inquiries | ✅ Automatic | Complex disputes |
| Payment options | ✅ Automatic | Hardship cases |
| Outage reports | ✅ Automatic | Safety emergencies |
| Service changes | ✅ Automatic | Special requests |
| Account lookup | ✅ Automatic | Identity verification |

### Example Flow: High Bill Inquiry

1. **Customer calls**: "My bill is way too high!"
2. **AI Agent**: Explains seasonal usage, offers comparison to last year
3. **Customer**: "This is ridiculous, I want to speak to someone"
4. **AI Agent**: "Of course, connecting you now..."
5. **Human takes over** — Copilot shows:
   - Customer sentiment: Frustrated ⚠️
   - Suggestion: "Consider goodwill credit ($25)"
   - Account history at a glance

## 🏥 Healthcare Scheduling

- AI handles appointment booking
- Humans handle medical questions
- HIPAA-compliant context sharing

## 🛒 E-Commerce Support

- AI handles order status, returns
- Humans handle escalations, VIP customers
- Full order history in copilot

## 🏦 Financial Services

- AI handles balance inquiries, FAQs
- Humans handle fraud, complex transactions
- Compliance-ready audit trails

---

# 6️⃣ Benefits

## For Customers

| Benefit | Impact |
|---------|--------|
| **No wait times** | AI answers instantly |
| **24/7 availability** | Help anytime |
| **Seamless escalation** | Human when needed |
| **Consistent quality** | AI doesn't have bad days |

## For Agents

| Benefit | Impact |
|---------|--------|
| **AI Copilot** | Answers at their fingertips |
| **Context on arrival** | No "please repeat your issue" |
| **Handle complex cases** | AI filters easy ones |
| **Reduced burnout** | Focus on meaningful work |

## For Business

| Benefit | Impact |
|---------|--------|
| **60-70% AI resolution** | Dramatic cost savings |
| **Improved CSAT** | Faster resolution times |
| **Scalability** | Handle volume spikes |
| **Analytics** | Data-driven optimization |
| **Compliance** | Full conversation logs |

## ROI Projection

```
Traditional Contact Center:
  100 agents × $45K/year = $4.5M

With Senpilot (70% AI resolution):
  30 agents × $45K/year = $1.35M
  + Senpilot platform      = $XXX K

  Annual Savings: ~$3M+ 💰
```

---

# 7️⃣ Live Demo

## Demo Scenarios

### Scenario 1: Text Chat with AI
1. Customer asks about bill
2. AI provides detailed response
3. Customer asks to speak to human
4. Seamless handoff demonstrated

### Scenario 2: Agent Dashboard
1. Queue panel shows incoming chats
2. Agent selects a conversation
3. Copilot provides real-time suggestions
4. Agent takes over from AI

### Scenario 3: Emergency Handling
1. Customer mentions "gas smell"
2. AI immediately provides safety instructions
3. Auto-escalation to emergency team
4. Copilot alerts: 🚨 CRITICAL

---

# 8️⃣ Future Roadmap

## Version 1.1 (Next Quarter)

- [ ] **Voice Web Calls** — Browser-based voice using Retell WebRTC
- [ ] **Customer Portal** — Account self-service
- [ ] **Mobile App** — Agent dashboard on mobile
- [ ] **Multi-language** — Spanish, French support

## Version 1.2 (6 Months)

- [ ] **Predictive Routing** — AI decides best agent for case
- [ ] **Proactive Outreach** — AI calls customers before they call you
- [ ] **Training Mode** — AI learns from human corrections
- [ ] **Integration Hub** — Connect to CRM, billing systems

## Version 2.0 (1 Year)

- [ ] **Video Support** — Face-to-face when needed
- [ ] **Sentiment-Based Pricing** — Dynamic wait times
- [ ] **AI Quality Assurance** — Auto-review all conversations
- [ ] **White-label Platform** — Resell to other utilities

---

# 🎯 Summary

## Senpilot delivers:

1. **Instant AI Response** — No more hold music
2. **Seamless Human Backup** — When complexity arises
3. **Context Preservation** — Nothing lost in transition
4. **Agent Empowerment** — Copilot makes reps superhuman
5. **Business Intelligence** — Data on every interaction

## The Bottom Line

> "The best of AI and human service, 
> working together in perfect harmony."

---

# 📞 Contact & Questions

## Repository
```
github.com/[your-org]/Senpilot-Customer-Service-App
```

## Tech Stack Summary
- Backend: Node.js + TypeScript + PostgreSQL + Redis
- Frontend: React + Vite + Socket.io
- AI: Retell (Voice) + Gemini (Chat) + OpenAI (Embeddings)
- Telephony: Telnyx

## Thank You!

Questions?

---

# Appendix: API Reference

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send chat message |
| `/api/chat/switch` | POST | Switch AI ↔ Human |
| `/api/voice/web-call` | POST | Create voice call |
| `/api/copilot/search` | POST | Search knowledge base |
| `/api/analytics/dashboard` | GET | Get live metrics |

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `transcript:update` | Server → Client | New message |
| `copilot:suggestion` | Server → Client | AI suggestion |
| `call:state_update` | Server → Client | Mode changed |
| `call:request_switch` | Client → Server | Request handoff |

---

*Senpilot — Intelligent Customer Service Platform*

