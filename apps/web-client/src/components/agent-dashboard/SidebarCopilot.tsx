import { useState } from 'react';
import type { CopilotSuggestion } from 'shared-types';
import styles from './SidebarCopilot.module.css';

interface SidebarCopilotProps {
  suggestions: CopilotSuggestion[];
}

export default function SidebarCopilot({ suggestions }: SidebarCopilotProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CopilotSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'alerts'>('suggestions');

  // Separate alerts (frustration warnings, urgent items) from regular suggestions
  const alerts = suggestions.filter(s => 
    s.title.toLowerCase().includes('frustration') ||
    s.title.toLowerCase().includes('urgent') ||
    s.title.toLowerCase().includes('warning')
  );
  const regularSuggestions = suggestions.filter(s => !alerts.includes(s));

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // In production, this would call the backend
      // For now, we'll simulate a search
      const mockResults: CopilotSuggestion[] = [
        {
          type: 'INFO',
          title: `Results for "${searchQuery}"`,
          content: 'Search functionality connected to knowledge base...',
          confidenceScore: 0.9,
        }
      ];
      setSearchResults(mockResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className={styles.copilot}>
      {/* Header with tabs */}
      <header className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'suggestions' ? styles.active : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            <span className={styles.tabIcon}>✨</span>
            Suggestions
            {regularSuggestions.length > 0 && (
              <span className={styles.tabBadge}>{regularSuggestions.length}</span>
            )}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'alerts' ? styles.active : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <span className={styles.tabIcon}>⚠️</span>
            Alerts
            {alerts.length > 0 && (
              <span className={`${styles.tabBadge} ${styles.alertBadge}`}>{alerts.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Search bar */}
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.searchInput}
        />
        {searchQuery ? (
          <button className={styles.searchBtn} onClick={clearSearch} title="Clear">
            ✕
          </button>
        ) : (
          <button className={styles.searchBtn} onClick={handleSearch} title="Search">
            🔍
          </button>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Search results */}
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            <div className={styles.sectionHeader}>
              <span>Search Results</span>
              <button className={styles.clearBtn} onClick={clearSearch}>Clear</button>
            </div>
            {searchResults.map((result, index) => (
              <SuggestionCard key={`search-${index}`} suggestion={result} />
            ))}
          </div>
        )}

        {isSearching && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            Searching...
          </div>
        )}

        {/* Alerts tab */}
        {activeTab === 'alerts' && (
          <div className={styles.alerts}>
            {alerts.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>✓</div>
                <p className={styles.emptyText}>No alerts at this time</p>
              </div>
            ) : (
              alerts.map((alert, index) => (
                <AlertCard key={index} suggestion={alert} />
              ))
            )}
          </div>
        )}

        {/* Suggestions tab */}
        {activeTab === 'suggestions' && (
          <div className={styles.suggestions}>
            {regularSuggestions.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>🎯</div>
                <p className={styles.emptyText}>
                  Suggestions will appear here based on the conversation
                </p>
              </div>
            ) : (
              regularSuggestions.map((suggestion, index) => (
                <SuggestionCard key={index} suggestion={suggestion} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Quick actions footer */}
      <div className={styles.quickActions}>
        <button className={styles.quickAction} title="Canned Responses">
          💬 Responses
        </button>
        <button className={styles.quickAction} title="Customer History">
          👤 History
        </button>
        <button className={styles.quickAction} title="Escalate">
          📤 Escalate
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: CopilotSuggestion }) {
  const isAction = suggestion.type === 'ACTION';
  const [isExpanded, setIsExpanded] = useState(false);
  
  const truncatedContent = suggestion.content.length > 120 && !isExpanded
    ? suggestion.content.substring(0, 120) + '...'
    : suggestion.content;

  return (
    <div className={`${styles.card} ${isAction ? styles.action : styles.info}`}>
      <div className={styles.cardHeader}>
        <span className={styles.cardType}>
          {isAction ? '⚡ Action' : '📚 Info'}
        </span>
        <span className={styles.confidence}>
          {Math.round(suggestion.confidenceScore * 100)}%
        </span>
      </div>
      <h3 className={styles.cardTitle}>{suggestion.title}</h3>
      <p className={styles.cardContent}>
        {truncatedContent}
        {suggestion.content.length > 120 && (
          <button 
            className={styles.expandBtn}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </p>
      {isAction && (
        <button className={styles.actionButton}>
          Apply Suggestion
        </button>
      )}
    </div>
  );
}

function AlertCard({ suggestion }: { suggestion: CopilotSuggestion }) {
  return (
    <div className={styles.alertCard}>
      <div className={styles.alertIcon}>⚠️</div>
      <div className={styles.alertContent}>
        <h3 className={styles.alertTitle}>{suggestion.title}</h3>
        <p className={styles.alertText}>{suggestion.content}</p>
      </div>
      <button className={styles.dismissBtn} title="Dismiss">✕</button>
    </div>
  );
}
