import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env, hasTelnyxConfig, hasRetellConfig } from "./config/env.js";

// Controllers
import { callController } from "./controllers/callController.js";
import { retellController } from "./controllers/retellController.js";
import { switchController } from "./controllers/switchController.js";
import { chatController } from "./controllers/chatController.js";
import { analyticsController } from "./controllers/analyticsController.js";
import { copilotController } from "./controllers/copilotController.js";
import { voiceController } from "./controllers/voiceController.js";

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services: {
      telnyx: hasTelnyxConfig() ? "configured" : "not configured",
      retell: hasRetellConfig() ? "configured" : "not configured",
    },
  });
});

// API Routes
app.use("/api/switch", switchController);       // AI↔Human switching
app.use("/api/chat", chatController);           // Text chat
app.use("/api/analytics", analyticsController); // Diagnostics & metrics
app.use("/api/copilot", copilotController);     // AI copilot & knowledge base
app.use("/api/voice", voiceController);         // Voice calls (Retell AI)

// Webhook Routes
app.use("/webhooks/telnyx", callController); // Telnyx call events
app.use("/webhooks/retell", retellController); // Retell AI events

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Error:", err.message);
    res.status(500).json({
      error: "Internal Server Error",
      message: env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
);

export { app };
