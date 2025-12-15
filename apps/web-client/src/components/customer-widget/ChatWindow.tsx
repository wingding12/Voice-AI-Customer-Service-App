/**
 * ChatWindow - Customer Chat Widget
 * 
 * Real-time chat interface for customers to communicate with
 * AI agents and human representatives.
 * 
 * Uses Socket.io to receive agent messages in real-time.
 */

import { useState, useRef, useEffect } from 'react';
import { useChatSocket } from '../../hooks/useChatSocket';
import styles from './ChatWindow.module.css';

export default function ChatWindow() {
  const {
    isConnected,
    sessionId,
    messages,
    agentMode,
    joinSession,
    addLocalMessage,
    addAssistantMessage,
    setAgentMode,
  } = useChatSocket();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    // Add message to local state immediately
    addLocalMessage(content.trim());
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      // Check if this is a new session (first message)
      const isNewSession = data.sessionId && data.sessionId !== sessionId;
      
      // Join the session room if this is a new session
      if (isNewSession) {
        joinSession(data.sessionId);
      }

      // Check if mode changed (AI to Human)
      if (data.reply?.includes('connecting you with')) {
        setAgentMode('HUMAN');
      }

      // Add the AI reply to messages
      // For new sessions, we MUST add locally because we weren't in the room 
      // when the message was emitted. For existing sessions with socket connected,
      // we'll receive it via Socket.io, but adding it here too won't hurt
      // because addAssistantMessage deduplicates by content.
      if (data.reply && data.reply.trim()) {
        // Small delay to ensure it appears after the customer's message
        setTimeout(() => {
          addAssistantMessage(data.reply, false);
        }, 100);
      }

    } catch (error) {
      console.error('Chat error:', error);
      // Add error message locally
      addLocalMessage('Sorry, there was an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input);
  };

  const handleTalkToHuman = async () => {
    if (!sessionId) {
      // If no session exists yet, send a message first to create the session
      await sendMessage('I would like to speak with a human representative.');
      return;
    }
    
    setIsLoading(true);
    try {
      // Directly call the switch API instead of sending /human as a message
      const response = await fetch('/api/chat/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          direction: 'AI_TO_HUMAN',
        }),
      });

      if (!response.ok) throw new Error('Failed to switch to human');

      const data = await response.json();
      if (data.success) {
        setAgentMode('HUMAN');
        // Add a system message to show the switch happened
        addAssistantMessage("I'm connecting you with a human representative. They will be with you shortly.", false);
      }
    } catch (error) {
      console.error('Switch to human error:', error);
      addAssistantMessage("Sorry, I couldn't connect you with a representative right now. Please try again.", false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToAI = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          direction: 'HUMAN_TO_AI',
        }),
      });

      if (!response.ok) throw new Error('Failed to switch');

      const data = await response.json();
      if (data.success) {
        setAgentMode('AI');
        // Add a system message
        addLocalMessage('You are now chatting with the AI assistant.');
      }
    } catch (error) {
      console.error('Switch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={styles.chatWindow}>
      {/* Agent Mode Header */}
      <div className={`${styles.agentHeader} ${agentMode === 'HUMAN' ? styles.humanMode : ''}`}>
        <div className={styles.agentInfo}>
          <span className={styles.agentIcon}>
            {agentMode === 'AI' ? '🤖' : '👤'}
          </span>
          <div className={styles.agentDetails}>
            <span className={styles.agentLabel}>
              {agentMode === 'AI' ? 'AI Assistant' : 'Human Representative'}
            </span>
            <span className={styles.agentStatus}>
              <span className={`${styles.statusDot} ${isConnected ? styles.connected : ''}`} />
              {isConnected ? 'Online' : 'Connecting...'}
            </span>
          </div>
        </div>
        {sessionId && (
          <span className={styles.sessionId}>#{sessionId.slice(-6)}</span>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <span className={styles.welcomeIcon}>⚡</span>
            <h3>Welcome to Utility Support!</h3>
            <p>I'm your AI assistant. How can I help you today?</p>
            <div className={styles.quickActions}>
              <button
                className={styles.quickAction}
                onClick={() => sendMessage('I have a question about my bill')}
              >
                💰 Billing
              </button>
              <button
                className={styles.quickAction}
                onClick={() => sendMessage('I want to report a power outage')}
              >
                ⚡ Outage
              </button>
              <button
                className={styles.quickAction}
                onClick={() => sendMessage('I need to set up new service')}
              >
                🏠 New Service
              </button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${styles[message.role]}`}
          >
            {message.role === 'assistant' && (
              <span className={styles.messageIcon}>
                {message.isHuman ? '👤' : '🤖'}
              </span>
            )}
            <div className={styles.messageBubble}>
              <div className={styles.messageContent}>{message.content}</div>
              <span className={styles.messageTime}>{formatTime(message.timestamp)}</span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <span className={styles.messageIcon}>
              {agentMode === 'AI' ? '🤖' : '👤'}
            </span>
            <div className={styles.messageBubble}>
              <div className={styles.typing}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Mode Switch Buttons */}
      {messages.length > 0 && (
        <div className={styles.modePrompt}>
          {agentMode === 'AI' ? (
            <button
              className={styles.humanButton}
              onClick={handleTalkToHuman}
              disabled={isLoading}
            >
              <span className={styles.modeIcon}>👤</span>
              Talk to a Human
            </button>
          ) : (
            <button
              className={styles.aiButton}
              onClick={handleSwitchToAI}
              disabled={isLoading}
            >
              <span className={styles.modeIcon}>🤖</span>
              Switch to AI Assistant
            </button>
          )}
        </div>
      )}

      {/* Human Mode Indicator */}
      {agentMode === 'HUMAN' && (
        <div className={styles.humanModeNotice}>
          <span className={styles.humanModeIcon}>👤</span>
          <span>You're chatting with a human representative</span>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            agentMode === 'AI'
              ? 'Type your message...'
              : 'Message the representative...'
          }
          className={styles.input}
          disabled={isLoading}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!input.trim() || isLoading}
        >
          <span className={styles.sendIcon}>➤</span>
        </button>
      </form>
    </div>
  );
}
