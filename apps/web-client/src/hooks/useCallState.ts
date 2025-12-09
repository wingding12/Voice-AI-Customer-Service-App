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
      setTranscript((prev) => [...prev, data]);
    });

    socket.on('copilot:suggestion', (data: CopilotSuggestion) => {
      setSuggestions((prev) => [...prev, data]);
    });

    socket.on('call:switch', (data: { direction: string; timestamp: number }) => {
      setCallState((prev) => ({
        ...prev,
        mode: data.direction === 'AI_TO_HUMAN' ? 'HUMAN_REP' : 'AI_AGENT',
        switchCount: prev.switchCount + 1,
      }));
    });

    socket.on('call:end', () => {
      setCallState((prev) => ({ ...prev, status: 'ended' }));
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
      socketRef.current?.emit('call:request_switch', { callId: currentCallId, direction });
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
    joinCall,
    leaveCall,
    requestSwitch,
    clearSuggestion,
  };
}
