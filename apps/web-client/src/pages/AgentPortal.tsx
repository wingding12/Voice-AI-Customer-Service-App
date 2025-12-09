import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useCallState } from '../hooks/useCallState';
import ActiveCallBanner from '../components/agent-dashboard/ActiveCallBanner';
import LiveTranscript from '../components/agent-dashboard/LiveTranscript';
import SidebarCopilot from '../components/agent-dashboard/SidebarCopilot';
import ControlPanel from '../components/agent-dashboard/ControlPanel';
import ConnectionStatus from '../components/shared/ConnectionStatus';
import styles from './AgentPortal.module.css';

export default function AgentPortal() {
  const { isConnected } = useSocket();
  const { callState, transcript, suggestions, requestSwitch } = useCallState();
  const [agentId] = useState('AGENT_001'); // TODO: Get from auth

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
        <div className={styles.headerRight}>
          <span className={styles.agentId}>Agent: {agentId}</span>
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        {/* Left: Call info and transcript */}
        <section className={styles.callSection}>
          <ActiveCallBanner callState={callState} />
          <LiveTranscript entries={transcript} />
          <ControlPanel 
            callState={callState} 
            isConnected={isConnected}
            onSwitch={requestSwitch}
          />
        </section>

        {/* Right: Copilot sidebar */}
        <aside className={styles.sidebar}>
          <SidebarCopilot suggestions={suggestions} />
        </aside>
      </main>
    </div>
  );
}

