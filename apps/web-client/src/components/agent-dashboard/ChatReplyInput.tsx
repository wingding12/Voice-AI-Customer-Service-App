/**
 * ChatReplyInput - Agent's text input for responding to customers
 * 
 * Allows agents to send messages to customers when in human-rep mode.
 * Uses the shared socket connection from useCallState.
 */

import { useState, useCallback } from 'react';
import styles from './ChatReplyInput.module.css';

interface ChatReplyInputProps {
  sessionId: string | null;
  isHumanMode: boolean;
  isSending: boolean;
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function ChatReplyInput({ 
  sessionId, 
  isHumanMode, 
  isSending,
  onSendMessage,
  disabled 
}: ChatReplyInputProps) {
  const [input, setInput] = useState('');

  const sendMessage = useCallback(() => {
    if (!input.trim() || !sessionId || !isHumanMode || isSending || disabled) return;
    
    onSendMessage(input.trim());
    setInput('');
  }, [input, sessionId, isHumanMode, isSending, disabled, onSendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!sessionId) {
    return (
      <div className={styles.container}>
        <div className={styles.placeholder}>
          <span className={styles.placeholderIcon}>👈</span>
          <span>Select a conversation from the queue to respond</span>
        </div>
      </div>
    );
  }

  if (!isHumanMode) {
    return (
      <div className={styles.container}>
        <div className={styles.aiMode}>
          <span className={styles.aiIcon}>🤖</span>
          <div className={styles.aiModeText}>
            <span className={styles.aiModeTitle}>AI is handling this conversation</span>
            <span className={styles.aiModeHint}>Click "Take Over" in controls to respond manually</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.humanModeHeader}>
        <span className={styles.humanIcon}>👤</span>
        <span className={styles.humanLabel}>You are now responding to the customer</span>
      </div>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response to the customer..."
            className={styles.input}
            disabled={disabled || isSending}
            rows={3}
            autoFocus
          />
        </div>
        
        <div className={styles.actions}>
          <span className={styles.hint}>
            Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
          </span>
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={!input.trim() || disabled || isSending}
          >
            {isSending ? (
              <span className={styles.spinner} />
            ) : (
              <>
                <span className={styles.sendIcon}>➤</span>
                Send
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
