import type { CallState } from '../../hooks/useCallState';
import styles from './ControlPanel.module.css';

interface ControlPanelProps {
  callState: CallState;
  isConnected: boolean;
  onSwitch: (direction: 'AI_TO_HUMAN' | 'HUMAN_TO_AI') => void;
}

export default function ControlPanel({ callState, isConnected, onSwitch }: ControlPanelProps) {
  
  const { status, mode } = callState;
  const isActive = status === 'active';
  const isAI = mode === 'AI_AGENT';
  
  const handleSwitch = () => {
    const direction = isAI ? 'AI_TO_HUMAN' : 'HUMAN_TO_AI';
    onSwitch(direction);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.modeIndicator}>
        <span className={styles.modeLabel}>Current Mode:</span>
        <span className={`${styles.modeValue} ${isAI ? styles.ai : styles.human}`}>
          {isAI ? '🤖 AI Agent' : '👤 Human Rep'}
        </span>
      </div>

      <div className={styles.controls}>
        <button
          className={`${styles.switchButton} ${isAI ? styles.takeOver : styles.handBack}`}
          onClick={handleSwitch}
          disabled={!isActive || !isConnected}
        >
          {isAI ? (
            <>
              <span className={styles.buttonIcon}>👤</span>
              Take Over Call
            </>
          ) : (
            <>
              <span className={styles.buttonIcon}>🤖</span>
              Hand Back to AI
            </>
          )}
        </button>

        <div className={styles.quickActions}>
          <button className={styles.actionButton} disabled={!isActive}>
            🔇 Mute
          </button>
          <button className={styles.actionButton} disabled={!isActive}>
            ⏸️ Hold
          </button>
          <button className={`${styles.actionButton} ${styles.endCall}`} disabled={!isActive}>
            📞 End
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className={styles.warning}>
          ⚠️ Not connected to server
        </div>
      )}
    </div>
  );
}

