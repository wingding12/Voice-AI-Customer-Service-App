import { useState, useEffect } from 'react';
import type { CopilotSuggestion } from 'shared-types';
import styles from './SidebarCopilot.module.css';

interface SidebarCopilotProps {
  suggestions: CopilotSuggestion[];
  sessionId?: string | null;
}

export default function SidebarCopilot({ suggestions, sessionId }: SidebarCopilotProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copilotStatus, setCopilotStatus] = useState<{ llmEnabled: boolean; llmProvider?: string } | null>(null);

  // Check copilot status on mount
  useEffect(() => {
    fetch('/api/copilot/status')
      .then(res => res.json())
      .then(data => setCopilotStatus(data))
      .catch(err => console.error('Failed to check copilot status:', err));
  }, []);

  // Separate alerts from regular suggestions
  const alerts = suggestions.filter(s => 
    s.metadata?.priority === 'CRITICAL' ||
    s.title.toLowerCase().includes('emergency') ||
    s.title.toLowerCase().includes('frustrat') ||
    s.title.toLowerCase().includes('warning')
  );
  const regularSuggestions = suggestions.filter(s => !alerts.includes(s));

  // Request suggestions for current session
  const refreshSuggestions = async () => {
    if (!sessionId) return;
    
    setIsRefreshing(true);
    try {
      await fetch('/api/copilot/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, emit: true }),
      });
    } catch (error) {
      console.error('Failed to refresh suggestions:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className={styles.copilot}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.title}>
            <span className={styles.titleIcon}>✨</span>
            AI Copilot
          </h2>
          {copilotStatus?.llmEnabled && (
            <span className={styles.llmBadge}>
              Gemini
            </span>
          )}
        </div>
        <p className={styles.subtitle}>
          Real-time suggestions to help you assist the customer
        </p>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {/* Alerts section - show at top if any */}
        {alerts.length > 0 && (
          <div className={styles.alertsSection}>
            {alerts.map((alert, index) => (
              <AlertCard key={`alert-${index}`} suggestion={alert} />
            ))}
          </div>
        )}

        {/* Suggestions section */}
        <div className={styles.suggestionsSection}>
          {!sessionId ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>💬</div>
              <p className={styles.emptyTitle}>No Active Conversation</p>
              <p className={styles.emptyText}>
                Select a conversation from the queue to see AI-powered suggestions
              </p>
            </div>
          ) : regularSuggestions.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎯</div>
              <p className={styles.emptyTitle}>Analyzing Conversation</p>
              <p className={styles.emptyText}>
                Suggestions will appear as the conversation progresses
              </p>
              <button 
                className={styles.refreshButton}
                onClick={refreshSuggestions}
                disabled={isRefreshing}
              >
                {isRefreshing ? 'Refreshing...' : '🔄 Refresh Suggestions'}
              </button>
            </div>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Suggestions</span>
                <button 
                  className={styles.refreshBtn}
                  onClick={refreshSuggestions}
                  disabled={isRefreshing}
                  title="Refresh suggestions"
                >
                  {isRefreshing ? '...' : '🔄'}
                </button>
              </div>
              <div className={styles.suggestionsList}>
                {regularSuggestions.map((suggestion, index) => (
                  <SuggestionCard key={`suggestion-${index}`} suggestion={suggestion} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          <span className={styles.footerIcon}>🤖</span>
          <span className={styles.footerText}>
            Powered by Gemini AI
          </span>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: CopilotSuggestion }) {
  const isAction = suggestion.type === 'ACTION';
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const truncatedContent = suggestion.content.length > 200 && !isExpanded
    ? suggestion.content.substring(0, 200) + '...'
    : suggestion.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.card} ${isAction ? styles.actionCard : styles.infoCard}`}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          {isAction ? '💡' : '📋'}
        </span>
        <h3 className={styles.cardTitle}>{suggestion.title}</h3>
      </div>
      <p className={styles.cardContent}>
        {truncatedContent}
      </p>
      {suggestion.content.length > 200 && (
        <button 
          className={styles.expandBtn}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▲ Show less' : '▼ Show more'}
        </button>
      )}
      <div className={styles.cardActions}>
        <button 
          className={styles.copyBtn}
          onClick={handleCopy}
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
        <span className={styles.confidence}>
          {Math.round(suggestion.confidenceScore * 100)}% confidence
        </span>
      </div>
    </div>
  );
}

function AlertCard({ suggestion }: { suggestion: CopilotSuggestion }) {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  const isEmergency = suggestion.metadata?.priority === 'CRITICAL' || 
    suggestion.title.toLowerCase().includes('emergency');

  return (
    <div className={`${styles.alertCard} ${isEmergency ? styles.emergency : ''}`}>
      <div className={styles.alertHeader}>
        <span className={styles.alertIcon}>
          {isEmergency ? '🚨' : '⚠️'}
        </span>
        <h3 className={styles.alertTitle}>{suggestion.title}</h3>
        <button 
          className={styles.dismissBtn} 
          onClick={() => setDismissed(true)}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
      <p className={styles.alertText}>{suggestion.content}</p>
    </div>
  );
}
