import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { CopilotSuggestion, CallStateUpdate, TranscriptEntry } from 'shared-types';

let io: SocketIOServer | null = null;

// Room naming convention: agent:<agentId>, call:<callId>
function agentRoom(agentId: string): string {
  return `agent:${agentId}`;
}

function callRoom(callId: string): string {
  return `call:${callId}`;
}

export function initializeAgentGateway(socketServer: SocketIOServer): void {
  io = socketServer;
  
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Agent connected: ${socket.id}`);
    
    // Agent joins their personal room
    socket.on('agent:join', (agentId: string) => {
      socket.join(agentRoom(agentId));
      console.log(`👤 Agent ${agentId} joined their room`);
    });
    
    // Agent joins a specific call room to receive updates
    socket.on('call:join', (callId: string) => {
      socket.join(callRoom(callId));
      console.log(`📞 Socket ${socket.id} joined call ${callId}`);
    });
    
    // Agent leaves a call room
    socket.on('call:leave', (callId: string) => {
      socket.leave(callRoom(callId));
      console.log(`📞 Socket ${socket.id} left call ${callId}`);
    });

    // Handle switch request from agent dashboard
    socket.on('call:request_switch', (data: { callId: string; direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI' }) => {
      console.log(`🔄 Switch requested: ${data.direction} for call ${data.callId}`);
      // TODO: Implement actual switch logic with Telnyx/Retell
      // For now, emit the switch event to update UI (broadcast to all in call room)
      if (io) {
        io.to(callRoom(data.callId)).emit('call:switch', { 
          direction: data.direction, 
          timestamp: Date.now() 
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`🔌 Agent disconnected: ${socket.id}`);
    });
  });
}

// Emit functions for backend services to use

export function emitCopilotSuggestion(callId: string, suggestion: CopilotSuggestion): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(callRoom(callId)).emit('copilot:suggestion', suggestion);
}

export function emitCallStateUpdate(callId: string, update: CallStateUpdate): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(callRoom(callId)).emit('call:state_update', update);
}

export function emitTranscriptUpdate(
  callId: string, 
  entry: TranscriptEntry
): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(callRoom(callId)).emit('transcript:update', entry);
}

export function emitSwitchEvent(
  callId: string, 
  direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI'
): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(callRoom(callId)).emit('call:switch', { direction, timestamp: Date.now() });
}

export function emitCallEnd(callId: string): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(callRoom(callId)).emit('call:end', { callId, timestamp: Date.now() });
}

