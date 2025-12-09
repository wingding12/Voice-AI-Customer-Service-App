import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { initializeAgentGateway } from './sockets/agentGateway.js';
import { connectRedis } from './services/state/sessionStore.js';

const httpServer = createServer(app);

// Socket.io setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: env.FRONTEND_URL,
    credentials: true,
  },
});

// Initialize Socket.io gateway for agent dashboard
initializeAgentGateway(io);

async function startServer() {
  try {
    // Connect to Redis
    await connectRedis();
    
    httpServer.listen(env.PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Customer Service Platform Backend                    ║
║                                                           ║
║   Server:    http://localhost:${env.PORT}                     ║
║   Health:    http://localhost:${env.PORT}/health              ║
║   Mode:      ${env.NODE_ENV.padEnd(11)}                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };
