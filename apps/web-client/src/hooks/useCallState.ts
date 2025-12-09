import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { CallStateUpdate, CopilotSuggestion, TranscriptEntry } from 'shared-types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export interface CallState {
  callId: string | null;
  status: 'idle' | 'ringing' | 'active' | 'ended';
  activeSpeaker: 'AI' | 'HUMAN' | 'CUSTOMER' | null;
  mode: 'AI_AGENT' | 'HUMAN_REP';
  customerId: string | null;
  startTime: number | null;
  switchCount: number;
}

const initialCallState: CallState = {
  callId: null,
  status: 'idle',
  activeSpeaker: null,
  mode: 'AI_AGENT',
  customerId: null,
  startTime: null,
  switchCount: 0,
};

export function useCallState() {
  const [isConnected, setIsConnected] = useState(false);
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Socket connection error:', error.message);
      setIsConnected(false);
    });

    // Call state events
    socket.on('call:state_update', (data: CallStateUpdate) => {
      setCallState((prev) => {
        // Don't update if call has already ended (prevents race conditions)
        if (prev.status === 'ended') {
          return prev;
        }
        return {
          ...prev,
          callId: data.callId,
          status: 'active',
          activeSpeaker: data.activeSpeaker,
          mode: data.mode,
          startTime: data.startTime ?? prev.startTime,
        };
      });
    });

    socket.on('transcript:update', (data: TranscriptEntry) => {
      setTranscript((prev) => {
        // Avoid duplicates based on timestamp and speaker
        const isDupe = prev.some(
          (e) => e.timestamp === data.timestamp && e.speaker === data.speaker
        );
        if (isDupe) return prev;
        return [...prev, data];
      });
    });

    socket.on('copilot:suggestion', (data: CopilotSuggestion) => {
      setSuggestions((prev) => [...prev, data]);
    });

    socket.on('call:switch', (data: { direction: string; timestamp: number }) => {
      console.log('🔄 Switch completed:', data.direction);
      setIsSwitching(false);
      setSwitchError(null);
      setCallState((prev) => ({
        ...prev,
        mode: data.direction === 'AI_TO_HUMAN' ? 'HUMAN_REP' : 'AI_AGENT',
        switchCount: prev.switchCount + 1,
      }));
    });

    // Switch error handling
    socket.on('switch:error', (data: { callId: string; error: string }) => {
      console.error('❌ Switch failed:', data.error);
      setIsSwitching(false);
      setSwitchError(data.error);
      // Clear error after 5 seconds
      setTimeout(() => setSwitchError(null), 5000);
    });

    socket.on('call:end', () => {
      setCallState((prev) => ({ ...prev, status: 'ended' }));
    });

    // Chat message events
    socket.on('chat:message_sent', () => {
      setIsSendingMessage(false);
    });

    socket.on('chat:message_error', (data: { error: string }) => {
      console.error('Chat message error:', data.error);
      setIsSendingMessage(false);
    });

    // Session history when joining
    socket.on('session:history', (data: { 
      transcript: TranscriptEntry[]; 
      mode: 'AI_AGENT' | 'HUMAN_REP';
      startTime: number;
    }) => {
      console.log('📜 Received session history:', data.transcript.length, 'messages');
      setTranscript(data.transcript);
      setCallState((prev) => ({
        ...prev,
        mode: data.mode,
        startTime: data.startTime,
      }));
    });

    // Cleanup
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Actions
  const joinCall = useCallback((callId: string) => {
    socketRef.current?.emit('call:join', callId);
    setCallState((prev) => ({ ...prev, callId, status: 'active', startTime: Date.now() }));
    // Clear old transcript, we'll receive history from server
    setTranscript([]);
    setSuggestions([]);
  }, []);

  const leaveCall = useCallback(() => {
    const currentCallId = callState.callId;
    if (currentCallId) {
      socketRef.current?.emit('call:leave', currentCallId);
    }
    setCallState(initialCallState);
    setTranscript([]);
    setSuggestions([]);
  }, [callState.callId]);

  const requestSwitch = useCallback((direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI') => {
    const currentCallId = callState.callId;
    if (currentCallId) {
      console.log('🔄 Requesting switch:', direction, 'for call', currentCallId);
      setIsSwitching(true);
      setSwitchError(null);
      socketRef.current?.emit('call:request_switch', { callId: currentCallId, direction });
    }
  }, [callState.callId]);

  const sendChatMessage = useCallback((message: string) => {
    const currentCallId = callState.callId;
    if (currentCallId && message.trim()) {
      setIsSendingMessage(true);
      socketRef.current?.emit('chat:send_message', {
        sessionId: currentCallId,
        message: message.trim(),
      });
    }
  }, [callState.callId]);

  const clearSuggestion = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    isConnected,
    callState,
    transcript,
    suggestions,
    isSendingMessage,
    isSwitching,
    switchError,
    joinCall,
    leaveCall,
    requestSwitch,
    sendChatMessage,
    clearSuggestion,
  };
}
