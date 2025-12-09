import { useState } from 'react';
import styles from './QueuePanel.module.css';

interface QueueItem {
  id: string;
  type: 'voice' | 'chat';
  customerName: string;
  customerPhone?: string;
  waitTime: number; // seconds
  preview?: string;
}

interface QueuePanelProps {
  onSelectItem: (id: string) => void;
  activeItemId: string | null;
}

// Mock data for demo - in production, this would come from backend via Socket.io
const mockQueue: QueueItem[] = [
  { id: 'call-001', type: 'voice', customerName: 'Unknown', customerPhone: '+1 555-0123', waitTime: 45, preview: 'Incoming call' },
  { id: 'chat-001', type: 'chat', customerName: 'Jane Smith', waitTime: 120, preview: 'Where is my order #12345?' },
  { id: 'chat-002', type: 'chat', customerName: 'Bob Wilson', waitTime: 85, preview: 'I need to return an item' },
];

export default function QueuePanel({ onSelectItem, activeItemId }: QueuePanelProps) {
  const [filter, setFilter] = useState<'all' | 'voice' | 'chat'>('all');

  const filteredQueue = mockQueue.filter(item => 
    filter === 'all' || item.type === filter
  );

  const voiceCount = mockQueue.filter(i => i.type === 'voice').length;
  const chatCount = mockQueue.filter(i => i.type === 'chat').length;

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
        <span className={styles.count}>{mockQueue.length}</span>
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
          filteredQueue.map(item => (
            <button
              key={item.id}
              className={`${styles.item} ${activeItemId === item.id ? styles.active : ''}`}
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
          <span className={styles.statValue}>12</span>
          <span className={styles.statLabel}>Resolved Today</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>2:34</span>
          <span className={styles.statLabel}>Avg Handle</span>
        </div>
      </div>
    </div>
  );
}

