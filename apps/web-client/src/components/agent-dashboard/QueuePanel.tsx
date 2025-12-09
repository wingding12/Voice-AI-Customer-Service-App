/**
 * QueuePanel - Live queue of incoming customer interactions
 * 
 * Shows real-time chats and calls waiting for agent attention.
 * Features:
 * - Live message preview updates
 * - Alert badges for customers needing human help
 * - Filter by type (voice/chat)
 */

import { useState } from 'react';
import type { QueueItem, QueueAlert } from '../../hooks/useAgentQueue';
import styles from './QueuePanel.module.css';

interface QueuePanelProps {
  queue: QueueItem[];
  alerts: QueueAlert[];
  unreadAlerts: number;
  onSelectItem: (id: string) => void;
  onDismissAlert: (alertId: string) => void;
  activeItemId: string | null;
}

export default function QueuePanel({ 
  queue, 
  alerts,
  unreadAlerts,
  onSelectItem, 
  onDismissAlert,
  activeItemId 
}: QueuePanelProps) {
  const [filter, setFilter] = useState<'all' | 'voice' | 'chat' | 'urgent'>('all');
  const [showAlerts, setShowAlerts] = useState(false);

  // Helper to check if item needs immediate attention
  const needsAttention = (item: QueueItem) => 
    item.mode === 'HUMAN_REP' && !item.isBeingAttended;

  const filteredQueue = queue.filter((item) => {
    if (filter === 'urgent') return needsAttention(item);
    if (filter === 'all') return true;
    return item.type === filter;
  });

  // Sort: urgent (unattended) items first, then attended, then by wait time
  const sortedQueue = [...filteredQueue].sort((a, b) => {
    const aUrgent = needsAttention(a);
    const bUrgent = needsAttention(b);
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return b.waitTime - a.waitTime;
  });

  const voiceCount = queue.filter((i) => i.type === 'voice').length;
  const chatCount = queue.filter((i) => i.type === 'chat').length;
  const urgentCount = queue.filter((i) => needsAttention(i)).length;

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatAlertTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Queue</h2>
        <div className={styles.headerBadges}>
          <span className={styles.count}>{queue.length}</span>
          {urgentCount > 0 && (
            <button 
              className={styles.alertBadge}
              onClick={() => setShowAlerts(!showAlerts)}
              title={`${urgentCount} need attention`}
            >
              🔔 {urgentCount}
              {unreadAlerts > 0 && <span className={styles.unreadDot} />}
            </button>
          )}
        </div>
      </div>

      {/* Alert Panel */}
      {showAlerts && alerts.length > 0 && (
        <div className={styles.alertPanel}>
          <div className={styles.alertHeader}>
            <span>Recent Alerts</span>
            <button 
              className={styles.closeAlerts}
              onClick={() => setShowAlerts(false)}
            >
              ✕
            </button>
          </div>
          <div className={styles.alertList}>
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`${styles.alertItem} ${alert.type === 'emergency' ? styles.emergency : ''}`}
              >
                <div className={styles.alertContent}>
                  <span className={styles.alertIcon}>
                    {alert.type === 'emergency' ? '🚨' : '👤'}
                  </span>
                  <div className={styles.alertText}>
                    <span className={styles.alertMessage}>{alert.message}</span>
                    <span className={styles.alertTime}>{formatAlertTime(alert.timestamp)}</span>
                  </div>
                </div>
                <div className={styles.alertActions}>
                  <button 
                    className={styles.alertAction}
                    onClick={() => {
                      onSelectItem(alert.sessionId);
                      onDismissAlert(alert.id);
                      setShowAlerts(false);
                    }}
                  >
                    Respond
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.filters}>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'urgent' ? styles.active : ''} ${urgentCount > 0 ? styles.hasUrgent : ''}`}
          onClick={() => setFilter('urgent')}
        >
          <span className={styles.filterIcon}>🔔</span>
          {urgentCount}
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
        {sortedQueue.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>✓</span>
            <span className={styles.emptyText}>
              {filter === 'urgent' ? 'No urgent items' : 'Queue is clear'}
            </span>
          </div>
        ) : (
          sortedQueue.map((item) => {
            const isUrgent = needsAttention(item);
            const isAttended = item.mode === 'HUMAN_REP' && item.isBeingAttended;
            
            return (
              <button
                key={item.id}
                className={`${styles.item} ${activeItemId === item.id ? styles.active : ''} ${isUrgent ? styles.needsHuman : ''} ${isAttended ? styles.beingAttended : ''}`}
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
                    {item.preview || (item.customerPhone ? item.customerPhone : 'New conversation')}
                  </span>
                  <div className={styles.itemMeta}>
                    {item.mode === 'AI_AGENT' ? (
                      <span className={styles.aiTag}>🤖 AI handling</span>
                    ) : isAttended ? (
                      <span className={styles.attendedTag}>✓ Being attended</span>
                    ) : (
                      <span className={styles.humanTag}>👤 Needs response</span>
                    )}
                  </div>
                </div>

                {isUrgent && (
                  <div className={styles.urgentBadge}>!</div>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{chatCount}</span>
          <span className={styles.statLabel}>Active Chats</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{urgentCount}</span>
          <span className={styles.statLabel}>Need Attention</span>
        </div>
      </div>
    </div>
  );
}
