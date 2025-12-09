import { useState, useRef, useEffect } from 'react';
import styles from './ChatWindow.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isHuman?: boolean;
}

type AgentMode = 'AI' | 'HUMAN';

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>('AI');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage.content,
          sessionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();
      
      // Update session ID
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Check if mode changed (AI to Human or vice versa)
      if (data.reply.includes('connecting you with a human')) {
        setAgentMode('HUMAN');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Sorry, I could not process that.',
        timestamp: Date.now(),
        isHuman: agentMode === 'HUMAN',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, there was an error. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    await sendMessage(input);
  };

  const handleTalkToHuman = () => {
    sendMessage('/human');
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
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
              <span className={styles.statusDot} />
              Online
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <span className={styles.welcomeIcon}>👋</span>
            <h3>Welcome!</h3>
            <p>I'm your AI assistant. How can I help you today?</p>
            <div className={styles.quickActions}>
              <button 
                className={styles.quickAction}
                onClick={() => sendMessage('Where is my order?')}
              >
                📦 Track Order
              </button>
              <button 
                className={styles.quickAction}
                onClick={() => sendMessage('How do I return an item?')}
              >
                ↩️ Returns
              </button>
              <button 
                className={styles.quickAction}
                onClick={() => sendMessage('I have a question')}
              >
                ❓ Help
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

      {/* Talk to Human Button */}
      {agentMode === 'AI' && (
        <div className={styles.humanPrompt}>
          <button 
            className={styles.humanButton}
            onClick={handleTalkToHuman}
            disabled={isLoading}
          >
            <span className={styles.humanIcon}>👤</span>
            Talk to a Human
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={agentMode === 'AI' ? "Type your message..." : "Message the representative..."}
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
