/**
 * useAgentQueue - Hook for receiving real-time queue updates
 * 
 * Used by the agent dashboard to see incoming chats and calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export interface QueueItem {
  id: string;
  type: 'voice' | 'chat';
  customerName: string;
  customerPhone?: string;
  waitTime: number;
  preview?: string;
  mode: 'AI_AGENT' | 'HUMAN_REP';
  createdAt: number;
}

export function useAgentQueue() {
  const [isConnected, setIsConnected] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket and subscribe to queue
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Agent queue socket connected:', socket.id);
      setIsConnected(true);
      
      // Subscribe to queue updates
      socket.emit('queue:subscribe');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Agent queue socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Agent queue socket error:', error.message);
      setIsConnected(false);
    });

    // Queue events
    socket.on('queue:add', (item: QueueItem) => {
      console.log('📋 New queue item:', item.id);
      setQueue((prev) => {
        // Don't add duplicates
        if (prev.some((i) => i.id === item.id)) {
          return prev;
        }
        return [...prev, item];
      });
    });

    socket.on('queue:remove', (data: { sessionId: string }) => {
      console.log('📋 Queue item removed:', data.sessionId);
      setQueue((prev) => prev.filter((i) => i.id !== data.sessionId));
    });

    socket.on('queue:update', (update: Partial<QueueItem> & { id: string }) => {
      console.log('📋 Queue item updated:', update.id);
      setQueue((prev) =>
        prev.map((item) =>
          item.id === update.id ? { ...item, ...update } : item
        )
      );
    });

    // Cleanup
    return () => {
      socket.emit('queue:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Update wait times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setQueue((prev) =>
        prev.map((item) => ({
          ...item,
          waitTime: Math.floor((Date.now() - item.createdAt) / 1000),
        }))
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Accept a queue item (remove from queue)
  const acceptItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    isConnected,
    queue,
    acceptItem,
  };
}

