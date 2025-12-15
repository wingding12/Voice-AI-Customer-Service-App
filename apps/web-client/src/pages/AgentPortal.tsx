/**
 * AgentPortal - Main dashboard for customer service agents
 * 
 * Features:
 * - Live queue of incoming chats/calls
 * - Real-time conversation view with transcript
 * - AI copilot suggestions
 * - Agent controls (switch, mute, hold, end)
 * - Chat reply input for human-rep mode
 */

import { useState, useCallback } from 'react';
import { useCallState } from '../hooks/useCallState';
import { useAgentQueue } from '../hooks/useAgentQueue';
import QueuePanel from '../components/agent-dashboard/QueuePanel';
import ActiveCallBanner from '../components/agent-dashboard/ActiveCallBanner';
import LiveTranscript from '../components/agent-dashboard/LiveTranscript';
import SidebarCopilot from '../components/agent-dashboard/SidebarCopilot';
import ControlPanel from '../components/agent-dashboard/ControlPanel';
import ChatReplyInput from '../components/agent-dashboard/ChatReplyInput';
import FooterMetrics from '../components/agent-dashboard/FooterMetrics';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import styles from './AgentPortal.module.css';

export default function AgentPortal() {
  const { 
    isConnected, 
    callState, 
    transcript, 
    suggestions, 
    isSendingMessage,
    isSwitching,
    switchError,
    requestSwitch, 
    joinCall, 
    leaveCall,
    sendChatMessage,
  } = useCallState();
  const { queue, alerts, unreadAlerts, dismissAlert } = useAgentQueue();
  const [agentId] = useState('AGENT_001'); // TODO: Get from auth
  const [agentStatus, setAgentStatus] = useState<'online' | 'away' | 'busy'>('online');

  const handleSelectQueueItem = useCallback((id: string) => {
    // Leave current session if any
    if (callState.callId && callState.callId !== id) {
      leaveCall();
    }
    // Join the selected session
    joinCall(id);
  }, [callState.callId, joinCall, leaveCall]);

  const handleStatusChange = (status: 'online' | 'away' | 'busy') => {
    setAgentStatus(status);
    // TODO: Emit status change to backend
  };

  // Determine if this is a chat session (vs voice)
  const isChat = callState.callId?.startsWith('chat-');
  const isVoice = callState.callId?.startsWith('voice-');
  const isHumanMode = callState.mode === 'HUMAN_REP';

  return (
    <div className={styles.portal}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.logo}>
            <span className={styles.logoIcon}>◈</span>
            Utility AI
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
              {isChat && <span className={styles.chatBadge}>💬 Chat</span>}
              {isVoice && <span className={styles.voiceBadge}>📞 Voice</span>}
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
            queue={queue}
            alerts={alerts}
            unreadAlerts={unreadAlerts}
            onSelectItem={handleSelectQueueItem}
            onDismissAlert={dismissAlert}
            activeItemId={callState.callId}
          />
        </aside>

        {/* Center: Active Conversation */}
        <main className={styles.conversationPanel}>
          <ActiveCallBanner callState={callState} />
          
          {/* Voice call indicator */}
          {isVoice && callState.status === 'active' && (
            <div className={styles.voiceCallHeader}>
              <span className={styles.voiceIcon}>📞</span>
              <span className={styles.voiceLabel}>Live Voice Call</span>
              <span className={styles.liveIndicator}>
                <span className={styles.liveDot}></span>
                LIVE
              </span>
              {isHumanMode && (
                <span className={styles.humanTakeoverBadge}>👤 Human Takeover Active</span>
              )}
            </div>
          )}
          
          <div className={styles.transcriptWrapper}>
            <LiveTranscript entries={transcript} />
          </div>
          
          {/* Show chat reply input for chat sessions */}
          {isChat && (
            <ChatReplyInput
              sessionId={callState.callId}
              isHumanMode={isHumanMode}
              isSending={isSendingMessage}
              onSendMessage={sendChatMessage}
              disabled={callState.status !== 'active'}
            />
          )}
          
          <ControlPanel 
            callState={callState} 
            isConnected={isConnected}
            isSwitching={isSwitching}
            switchError={switchError}
            onSwitch={requestSwitch}
          />
        </main>

        {/* Right: Copilot Sidebar */}
        <aside className={styles.copilotPanel}>
          <SidebarCopilot suggestions={suggestions} sessionId={callState.callId} />
        </aside>
      </div>

      {/* Footer with live metrics */}
      <FooterMetrics />
    </div>
  );
}
