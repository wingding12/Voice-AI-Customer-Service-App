/**
 * useChatSocket - Customer-side Socket.io hook for real-time chat
 * 
 * This hook manages the Socket.io connection for the customer chat widget.
 * It listens for agent messages and state updates so the customer
 * sees responses in real-time.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { TranscriptEntry, CallStateUpdate } from 'shared-types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isHuman?: boolean;
}

type AgentMode = 'AI' | 'HUMAN';

export function useChatSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentMode, setAgentMode] = useState<AgentMode>('AI');
  const socketRef = useRef<Socket | null>(null);
  const joinedSessionRef = useRef<string | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Customer chat socket connected:', socket.id);
      setIsConnected(true);
      
      // Rejoin session if we had one
      if (joinedSessionRef.current) {
        socket.emit('call:join', joinedSessionRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Customer chat socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Customer chat socket error:', error.message);
      setIsConnected(false);
    });

    // Listen for agent/AI messages
    socket.on('transcript:update', (data: TranscriptEntry) => {
      // Only process AI or HUMAN messages (not CUSTOMER - we add those ourselves)
      if (data.speaker === 'AI' || data.speaker === 'HUMAN') {
        const newMessage: ChatMessage = {
          id: `${data.timestamp}-${data.speaker}`,
          role: 'assistant',
          content: data.text,
          timestamp: data.timestamp,
          isHuman: data.speaker === 'HUMAN',
        };
        setMessages((prev) => {
          // Check for duplicate (might receive our own message back)
          if (prev.some(m => m.id === newMessage.id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
    });

    // Listen for state updates (mode changes)
    socket.on('call:state_update', (data: CallStateUpdate) => {
      if (data.mode === 'HUMAN_REP') {
        setAgentMode('HUMAN');
      } else if (data.mode === 'AI_AGENT') {
        setAgentMode('AI');
      }
    });

    // Listen for chat end
    socket.on('call:end', () => {
      setAgentMode('AI');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Join a chat session room
  const joinSession = useCallback((newSessionId: string) => {
    if (socketRef.current && newSessionId !== joinedSessionRef.current) {
      // Leave old session if any
      if (joinedSessionRef.current) {
        socketRef.current.emit('call:leave', joinedSessionRef.current);
      }
      
      socketRef.current.emit('call:join', newSessionId);
      joinedSessionRef.current = newSessionId;
      setSessionId(newSessionId);
      console.log(`📝 Customer joined chat session: ${newSessionId}`);
    }
  }, []);

  // Add a local message (from user input)
  const addLocalMessage = useCallback((content: string) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, message]);
  }, []);

  // Clear all messages (for new sessions)
  const clearMessages = useCallback(() => {
    setMessages([]);
    setAgentMode('AI');
    joinedSessionRef.current = null;
    setSessionId(null);
  }, []);

  return {
    isConnected,
    sessionId,
    messages,
    agentMode,
    joinSession,
    addLocalMessage,
    clearMessages,
    setAgentMode,
  };
}

