/**
 * useAgentQueue - Hook for receiving real-time queue updates
 * 
 * Used by the agent dashboard to see incoming chats and calls.
 * Features:
 * - Real-time queue updates
 * - Notifications when customers request human help
 * - Live message preview updates
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
  lastMessageAt?: number;
  isUrgent?: boolean;
  isBeingAttended?: boolean;
}

export interface QueueAlert {
  id: string;
  sessionId: string;
  type: 'human_requested' | 'emergency';
  message: string;
  timestamp: number;
}

// Notification sound (simple beep using Web Audio API)
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

export function useAgentQueue() {
  const [isConnected, setIsConnected] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [alerts, setAlerts] = useState<QueueAlert[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
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
        return [...prev, { ...item, lastMessageAt: Date.now() }];
      });
    });

    socket.on('queue:remove', (data: { sessionId: string }) => {
      console.log('📋 Queue item removed:', data.sessionId);
      setQueue((prev) => prev.filter((i) => i.id !== data.sessionId));
    });

    socket.on('queue:update', (update: Partial<QueueItem> & { id: string }) => {
      console.log('📋 Queue item updated:', update.id, update);
      
      setQueue((prev) => {
        const existingItem = prev.find((i) => i.id === update.id);
        const wasAI = existingItem?.mode === 'AI_AGENT';
        const isNowHuman = update.mode === 'HUMAN_REP';
        const isNowAI = update.mode === 'AI_AGENT';
        const isBeingAttended = update.isBeingAttended;
        
        // If switching from AI to HUMAN (and not being attended), create an alert
        if (wasAI && isNowHuman && !isBeingAttended) {
          const alert: QueueAlert = {
            id: `alert-${Date.now()}`,
            sessionId: update.id,
            type: update.preview?.includes('EMERGENCY') ? 'emergency' : 'human_requested',
            message: update.preview || 'Customer needs assistance',
            timestamp: Date.now(),
          };
          
          setAlerts((prev) => [alert, ...prev].slice(0, 10)); // Keep last 10 alerts
          setUnreadAlerts((prev) => prev + 1);
          
          // Play notification sound
          playNotificationSound();
          
          // Browser notification if permitted
          if (Notification.permission === 'granted') {
            new Notification('🔔 Customer needs help!', {
              body: update.preview || 'A customer has requested human assistance',
              icon: '/favicon.ico',
            });
          }
        }
        
        // If switching back to AI or being attended, clear the urgent state
        // Also remove any related alerts
        if (isNowAI || isBeingAttended) {
          setAlerts((prev) => prev.filter((a) => a.sessionId !== update.id));
        }
        
        return prev.map((item) =>
          item.id === update.id 
            ? { 
                ...item, 
                ...update, 
                lastMessageAt: Date.now(), 
                isUrgent: isNowHuman && !isBeingAttended,
                // Clear attended state if switching back to AI
                isBeingAttended: isNowAI ? false : (update.isBeingAttended ?? item.isBeingAttended),
              } 
            : item
        );
      });
    });

    // Live message preview updates
    socket.on('queue:message_preview', (data: { sessionId: string; preview: string }) => {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === data.sessionId
            ? { ...item, preview: data.preview, lastMessageAt: Date.now() }
            : item
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

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
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

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadAlerts(0);
  }, []);

  // Dismiss a single alert
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setUnreadAlerts((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark alerts as read
  const markAlertsRead = useCallback(() => {
    setUnreadAlerts(0);
  }, []);

  return {
    isConnected,
    queue,
    alerts,
    unreadAlerts,
    acceptItem,
    clearAlerts,
    dismissAlert,
    markAlertsRead,
  };
}
