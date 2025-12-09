import { useState } from 'react';
import ChatWindow from '../components/customer-widget/ChatWindow';
import CallButton from '../components/customer-widget/CallButton';
import styles from './CustomerDemo.module.css';

type Mode = 'chat' | 'voice';

export default function CustomerDemo() {
  const [mode, setMode] = useState<Mode>('chat');

  return (
    <div className={styles.demo}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>⚡ Utility Support</h1>
          <p className={styles.subtitle}>How would you like to connect?</p>
        </header>

        {/* Mode selector */}
        <div className={styles.modeSelector}>
          <button 
            className={`${styles.modeButton} ${mode === 'chat' ? styles.active : ''}`}
            onClick={() => setMode('chat')}
          >
            <span className={styles.modeIcon}>💬</span>
            Text Chat
          </button>
          <button 
            className={`${styles.modeButton} ${mode === 'voice' ? styles.active : ''}`}
            onClick={() => setMode('voice')}
          >
            <span className={styles.modeIcon}>📞</span>
            Voice Call
          </button>
        </div>

        {/* Content - keep both mounted, toggle visibility */}
        <div className={styles.content}>
          <div className={`${styles.chatPane} ${mode === 'chat' ? styles.visible : styles.hidden}`}>
            <ChatWindow />
          </div>
          <div className={`${styles.voicePane} ${mode === 'voice' ? styles.visible : styles.hidden}`}>
            <CallButton />
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>Powered by <span className={styles.brand}>Senpilot</span></p>
        </footer>
      </div>
    </div>
  );
}
