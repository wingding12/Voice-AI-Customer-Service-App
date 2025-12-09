import { useState, useCallback } from 'react';
import { useCallState } from '../hooks/useCallState';
import QueuePanel from '../components/agent-dashboard/QueuePanel';
import ActiveCallBanner from '../components/agent-dashboard/ActiveCallBanner';
import LiveTranscript from '../components/agent-dashboard/LiveTranscript';
import SidebarCopilot from '../components/agent-dashboard/SidebarCopilot';
import ControlPanel from '../components/agent-dashboard/ControlPanel';
import FooterMetrics from '../components/agent-dashboard/FooterMetrics';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import styles from './AgentPortal.module.css';

export default function AgentPortal() {
  const { isConnected, callState, transcript, suggestions, requestSwitch, joinCall } = useCallState();
  const [agentId] = useState('AGENT_001'); // TODO: Get from auth
  const [agentStatus, setAgentStatus] = useState<'online' | 'away' | 'busy'>('online');
  const [selectedQueueItem, setSelectedQueueItem] = useState<string | null>(null);

  const handleSelectQueueItem = useCallback((id: string) => {
    setSelectedQueueItem(id);
    // In production, this would accept the call/chat and join the session
    joinCall(id);
  }, [joinCall]);

  const handleStatusChange = (status: 'online' | 'away' | 'busy') => {
    setAgentStatus(status);
    // TODO: Emit status change to backend
  };

  return (
    <div className={styles.portal}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            Senpilot
          </h1>
          <span className={styles.badge}>Agent Dashboard</span>
        </div>
        
        <div className={styles.headerCenter}>
          {callState.status === 'active' && (
            <div className={styles.activeIndicator}>
              <span className={styles.activeDot} />
              <span className={styles.activeText}>
                {callState.mode === 'AI_AGENT' ? '🤖 AI Handling' : '👤 You\'re Live'}
              </span>
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.statusSelector}>
            <button
              className={`${styles.statusBtn} ${agentStatus === 'online' ? styles.active : ''}`}
              onClick={() => handleStatusChange('online')}
              title="Online"
            >
              <span className={`${styles.statusDot} ${styles.online}`} />
            </button>
            <button
              className={`${styles.statusBtn} ${agentStatus === 'away' ? styles.active : ''}`}
              onClick={() => handleStatusChange('away')}
              title="Away"
            >
              <span className={`${styles.statusDot} ${styles.away}`} />
            </button>
            <button
              className={`${styles.statusBtn} ${agentStatus === 'busy' ? styles.active : ''}`}
              onClick={() => handleStatusChange('busy')}
              title="Busy"
            >
              <span className={`${styles.statusDot} ${styles.busy}`} />
            </button>
          </div>
          
          <span className={styles.agentInfo}>
            <span className={styles.agentName}>Agent</span>
            <span className={styles.agentId}>{agentId}</span>
          </span>
          
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </header>

      {/* Main content - 3 column layout */}
      <div className={styles.mainWrapper}>
        {/* Left: Queue Panel */}
        <aside className={styles.queuePanel}>
          <QueuePanel 
            onSelectItem={handleSelectQueueItem}
            activeItemId={selectedQueueItem}
          />
        </aside>

        {/* Center: Active Conversation */}
        <main className={styles.conversationPanel}>
          <ActiveCallBanner callState={callState} />
          <div className={styles.transcriptWrapper}>
            <LiveTranscript entries={transcript} />
          </div>
          <ControlPanel 
            callState={callState} 
            isConnected={isConnected}
            onSwitch={requestSwitch}
          />
        </main>

        {/* Right: Copilot Sidebar */}
        <aside className={styles.copilotPanel}>
          <SidebarCopilot suggestions={suggestions} />
        </aside>
      </div>

      {/* Footer with live metrics */}
      <FooterMetrics />
    </div>
  );
}
