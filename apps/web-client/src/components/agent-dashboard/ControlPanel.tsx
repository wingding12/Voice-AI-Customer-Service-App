import type { CallState } from '../../hooks/useCallState';
import styles from './ControlPanel.module.css';

interface ControlPanelProps {
  callState: CallState;
  isConnected: boolean;
  isSwitching?: boolean;
  switchError?: string | null;
  onSwitch: (direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI') => void;
}

export default function ControlPanel({ 
  callState, 
  isConnected, 
  isSwitching = false,
  switchError,
  onSwitch 
}: ControlPanelProps) {
  
  const { status, mode, callId } = callState;
  const isActive = status === 'active';
  const isAI = mode === 'AI_AGENT';
  const isChat = callId?.startsWith('chat-');
  
  const handleSwitch = () => {
    if (isSwitching) return;
    const direction = isAI ? 'AI_TO_HUMAN' : 'HUMAN_TO_AI';
    onSwitch(direction);
  };

  return (
    <div className={styles.panel}>
      {switchError && (
        <div className={styles.error}>
          ⚠️ {switchError}
        </div>
      )}

      <div className={styles.modeIndicator}>
        <span className={styles.modeLabel}>Current Mode:</span>
        <span className={`${styles.modeValue} ${isAI ? styles.ai : styles.human}`}>
          {isAI ? '🤖 AI Agent' : '👤 Human Rep'}
        </span>
        {isChat && <span className={styles.chatTag}>Chat</span>}
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.switchButton} ${isAI ? styles.takeOver : styles.handBack}`}
          onClick={handleSwitch}
          disabled={!isActive || !isConnected || isSwitching || !callId}
        >
          {isSwitching ? (
            <>
              <span className={styles.spinner} />
              Switching...
            </>
          ) : isAI ? (
            <>
              <span className={styles.buttonIcon}>👤</span>
              Take Over {isChat ? 'Chat' : 'Call'}
            </>
          ) : (
            <>
              <span className={styles.buttonIcon}>🤖</span>
              Hand Back to AI
            </>
          )}
        </button>

        <div className={styles.quickActions}>
          <button className={styles.actionButton} disabled={!isActive || isChat}>
            🔇 Mute
          </button>
          <button className={styles.actionButton} disabled={!isActive || isChat}>
            ⏸️ Hold
          </button>
          <button className={`${styles.actionButton} ${styles.endCall}`} disabled={!isActive}>
            {isChat ? '✕ End Chat' : '📞 End Call'}
          </button>
        </div>
      </div>

      {!callId && (
        <div className={styles.hint}>
          👈 Select a conversation from the queue to get started
        </div>
      )}

      {!isConnected && (
        <div className={styles.warning}>
          ⚠️ Not connected to server
        </div>
      )}
    </div>
  );
}
