import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { CopilotSuggestion, CallStateUpdate, TranscriptEntry } from 'shared-types';
import { executeSwitch } from '../services/voice/switchService.js';
import { getDashboardMetrics } from '../services/analytics/analyticsService.js';
import { sendHumanResponse } from '../services/chat/chatService.js';
import { appendTranscript, getSession } from '../services/state/sessionStore.js';

let io: SocketIOServer | null = null;

// Room naming convention: agent:<agentId>, call:<callId>, metrics, queue
function agentRoom(agentId: string): string {
  return `agent:${agentId}`;
}

function callRoom(callId: string): string {
  return `call:${callId}`;
}

const METRICS_ROOM = 'metrics';
const QUEUE_ROOM = 'queue';

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
    socket.on('call:join', async (callId: string) => {
      socket.join(callRoom(callId));
      console.log(`📞 Socket ${socket.id} joined call ${callId}`);
      
      // Send session history to the joining agent
      try {
        const session = await getSession(callId);
        
        if (session) {
          socket.emit('session:history', {
            transcript: session.transcript || [],
            mode: session.mode || 'AI_AGENT',
            startTime: session.startTime || Date.now(),
          });
          console.log(`📜 Sent session history: ${session.transcript?.length || 0} messages`);
          
          // If this is a HUMAN_REP session, notify queue that agent is attending
          if (session.mode === 'HUMAN_REP') {
            emitQueueUpdate({
              id: callId,
              isBeingAttended: true,
            });
            console.log(`👤 Agent is now attending session ${callId}`);
          }
        }
      } catch (error) {
        console.error('Failed to send session history:', error);
      }
    });
    
    // Agent leaves a call room
    socket.on('call:leave', (callId: string) => {
      socket.leave(callRoom(callId));
      console.log(`📞 Socket ${socket.id} left call ${callId}`);
    });

    // Subscribe to real-time metrics updates
    socket.on('metrics:subscribe', async () => {
      socket.join(METRICS_ROOM);
      console.log(`📊 Socket ${socket.id} subscribed to metrics`);
      
      // Send initial metrics immediately
      try {
        const metrics = await getDashboardMetrics();
        socket.emit('metrics:update', metrics);
      } catch (error) {
        console.error('Failed to send initial metrics:', error);
      }
    });

    // Unsubscribe from metrics
    socket.on('metrics:unsubscribe', () => {
      socket.leave(METRICS_ROOM);
      console.log(`📊 Socket ${socket.id} unsubscribed from metrics`);
    });

    // Subscribe to queue updates (for agent dashboard)
    socket.on('queue:subscribe', () => {
      socket.join(QUEUE_ROOM);
      console.log(`📋 Socket ${socket.id} subscribed to queue`);
    });

    // Unsubscribe from queue
    socket.on('queue:unsubscribe', () => {
      socket.leave(QUEUE_ROOM);
      console.log(`📋 Socket ${socket.id} unsubscribed from queue`);
    });

    // Agent sends a reply in a chat session
    socket.on('chat:send_message', async (data: { sessionId: string; message: string }) => {
      console.log(`💬 Agent sending message to session ${data.sessionId}`);
      
      try {
        await sendHumanResponse(data.sessionId, data.message);
        // The sendHumanResponse function already emits transcript:update
        socket.emit('chat:message_sent', { sessionId: data.sessionId, success: true });
      } catch (error) {
        console.error('❌ Failed to send agent message:', error);
        socket.emit('chat:message_error', { 
          sessionId: data.sessionId, 
          error: error instanceof Error ? error.message : 'Failed to send message' 
        });
      }
    });

    // Handle switch request from agent dashboard
    socket.on('call:request_switch', async (data: { callId: string; direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI' }) => {
      console.log(`🔄 Switch requested: ${data.direction} for call ${data.callId}`);
      
      // Execute the actual switch via switchService
      const result = await executeSwitch({
        callId: data.callId,
        direction: data.direction,
        reason: 'AGENT_DASHBOARD',
      });

      if (!result.success) {
        console.error(`❌ Switch failed: ${result.error}`);
        // Notify the requesting socket of the failure
        socket.emit('switch:error', { 
          callId: data.callId, 
          error: result.error 
        });
      }
      // Success case: executeSwitch already emits events via emitCallStateUpdate and emitSwitchEvent
    });

    // ==================== Voice Call Transcript Forwarding ====================
    // These events are sent from the customer's voice call to forward transcripts to agents

    // Customer joins a voice call room
    socket.on('voice:join', (data: { sessionId: string }) => {
      socket.join(callRoom(data.sessionId));
      console.log(`🎤 Customer joined voice call room: ${data.sessionId}`);
      
      // Add to queue for agent visibility
      emitQueueAdd({
        id: data.sessionId,
        type: 'voice',
        customerName: 'Voice Caller',
        waitTime: 0,
        preview: 'Voice call in progress...',
        mode: 'AI_AGENT',
        createdAt: Date.now(),
      });
    });

    // Customer sends transcript update from Retell voice call
    socket.on('voice:transcript', async (data: { 
      sessionId: string; 
      role: string; 
      content: string; 
      timestamp: number 
    }) => {
      const { sessionId, role, content, timestamp } = data;
      
      // Map Retell roles to our speaker types
      const speaker = role === 'agent' ? 'AI' : 'CUSTOMER';
      
      console.log(`🎤 Voice transcript [${sessionId}] ${speaker}: ${content.substring(0, 50)}...`);
      
      // Save to session store
      await appendTranscript(sessionId, speaker as 'AI' | 'CUSTOMER', content, timestamp);
      
      // Forward to all agents watching this call (via call room)
      emitTranscriptUpdate(sessionId, {
        speaker,
        text: content,
        timestamp,
      });
      
      // Update queue preview
      const previewText = speaker === 'AI' ? `AI: ${content}` : `Caller: ${content}`;
      emitQueueMessagePreview(sessionId, previewText.substring(0, 60) + (previewText.length > 60 ? '...' : ''));
    });

    // Customer ends voice call
    socket.on('voice:end', (data: { sessionId: string }) => {
      console.log(`🎤 Voice call ended: ${data.sessionId}`);
      emitCallEnd(data.sessionId);
      emitQueueRemove(data.sessionId);
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

/**
 * Emit metrics update to all subscribed clients
 * Called after call state changes to keep dashboards in sync
 */
export async function emitMetricsUpdate(): Promise<void> {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  
  try {
    const metrics = await getDashboardMetrics();
    io.to(METRICS_ROOM).emit('metrics:update', metrics);
  } catch (error) {
    console.error('Failed to emit metrics update:', error);
  }
}

/**
 * Emit a specific metric event (for granular updates)
 */
export function emitMetricEvent(
  eventType: 'call:started' | 'call:ended' | 'switch:occurred',
  data: Record<string, unknown>
): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(METRICS_ROOM).emit('metrics:event', { type: eventType, data, timestamp: Date.now() });
}

/**
 * Queue item interface for real-time queue updates
 */
export interface QueueItem {
  id: string;
  type: 'voice' | 'chat';
  customerName: string;
  customerPhone?: string;
  waitTime: number;
  preview?: string;
  mode: 'AI_AGENT' | 'HUMAN_REP';
  createdAt: number;
  isBeingAttended?: boolean;
}

/**
 * Emit when a new session is added to the queue
 */
export function emitQueueAdd(item: QueueItem): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(QUEUE_ROOM).emit('queue:add', item);
}

/**
 * Emit when a session is removed from the queue (accepted or ended)
 */
export function emitQueueRemove(sessionId: string): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(QUEUE_ROOM).emit('queue:remove', { sessionId });
}

/**
 * Emit when a queue item is updated (e.g., mode change)
 */
export function emitQueueUpdate(item: Partial<QueueItem> & { id: string }): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(QUEUE_ROOM).emit('queue:update', item);
}

/**
 * Emit live message preview update to queue subscribers
 */
export function emitQueueMessagePreview(sessionId: string, preview: string): void {
  if (!io) {
    console.warn('Socket.io not initialized');
    return;
  }
  io.to(QUEUE_ROOM).emit('queue:message_preview', { sessionId, preview });
}

