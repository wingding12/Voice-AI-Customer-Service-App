/**
 * QueuePanel - Live queue of incoming customer interactions
 * 
 * Shows real-time chats and calls waiting for agent attention.
 * Uses Socket.io to receive live updates.
 */

import { useState } from 'react';
import type { QueueItem } from '../../hooks/useAgentQueue';
import styles from './QueuePanel.module.css';

interface QueuePanelProps {
  queue: QueueItem[];
  onSelectItem: (id: string) => void;
  activeItemId: string | null;
}

export default function QueuePanel({ queue, onSelectItem, activeItemId }: QueuePanelProps) {
  const [filter, setFilter] = useState<'all' | 'voice' | 'chat'>('all');

  const filteredQueue = queue.filter((item) =>
    filter === 'all' || item.type === filter
  );

  const voiceCount = queue.filter((i) => i.type === 'voice').length;
  const chatCount = queue.filter((i) => i.type === 'chat').length;
  const humanNeededCount = queue.filter((i) => i.mode === 'HUMAN_REP').length;

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Queue</h2>
        <span className={styles.count}>{queue.length}</span>
        {humanNeededCount > 0 && (
          <span className={styles.humanNeeded} title="Needs human response">
            👤 {humanNeededCount}
          </span>
        )}
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'voice' ? styles.active : ''}`}
          onClick={() => setFilter('voice')}
        >
          <span className={styles.filterIcon}>📞</span>
          {voiceCount}
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'chat' ? styles.active : ''}`}
          onClick={() => setFilter('chat')}
        >
          <span className={styles.filterIcon}>💬</span>
          {chatCount}
        </button>
      </div>

      <div className={styles.list}>
        {filteredQueue.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>✓</span>
            <span className={styles.emptyText}>Queue is clear</span>
          </div>
        ) : (
          filteredQueue.map((item) => (
            <button
              key={item.id}
              className={`${styles.item} ${activeItemId === item.id ? styles.active : ''} ${item.mode === 'HUMAN_REP' ? styles.needsHuman : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              <div className={styles.itemIcon}>
                {item.type === 'voice' ? '📞' : '💬'}
              </div>

              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={styles.itemName}>{item.customerName}</span>
                  <span className={styles.itemWait}>{formatWaitTime(item.waitTime)}</span>
                </div>
                <span className={styles.itemPreview}>
                  {item.customerPhone || item.preview}
                </span>
                {item.mode === 'HUMAN_REP' && (
                  <span className={styles.modeTag}>Needs Response</span>
                )}
              </div>

              {item.waitTime > 60 && (
                <div className={styles.urgentBadge}>!</div>
              )}
            </button>
          ))
        )}
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>—</span>
          <span className={styles.statLabel}>Resolved Today</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>—</span>
          <span className={styles.statLabel}>Avg Handle</span>
        </div>
      </div>
    </div>
  );
}
