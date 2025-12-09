import { useState, useEffect } from 'react';
import styles from './FooterMetrics.module.css';

interface Metrics {
  todayCalls: number;
  avgDuration: number;
  totalSwitches: number;
  aiResolutionRate: number;
}

export default function FooterMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    todayCalls: 0,
    avgDuration: 0,
    totalSwitches: 0,
    aiResolutionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch('/api/analytics/dashboard');
        if (response.ok) {
          const data = await response.json();
          setMetrics({
            todayCalls: data.today?.calls || 0,
            avgDuration: data.today?.avgDuration || 0,
            totalSwitches: data.today?.switches || 0,
            aiResolutionRate: Math.round(
              ((data.modeDistribution?.aiResolved || 0) / 
               Math.max(1, (data.modeDistribution?.aiResolved || 0) + 
                          (data.modeDistribution?.humanResolved || 0) + 
                          (data.modeDistribution?.mixed || 0))) * 100
            ),
          });
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <footer className={styles.footer}>
        <div className={styles.loading}>Loading metrics...</div>
      </footer>
    );
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.metric}>
        <span className={styles.icon}>📊</span>
        <span className={styles.label}>Today:</span>
        <span className={styles.value}>{metrics.todayCalls} calls</span>
      </div>
      
      <div className={styles.divider} />
      
      <div className={styles.metric}>
        <span className={styles.icon}>⏱️</span>
        <span className={styles.label}>Avg:</span>
        <span className={styles.value}>{formatDuration(metrics.avgDuration)}</span>
      </div>
      
      <div className={styles.divider} />
      
      <div className={styles.metric}>
        <span className={styles.icon}>🔄</span>
        <span className={styles.label}>Switches:</span>
        <span className={styles.value}>{metrics.totalSwitches}</span>
      </div>
      
      <div className={styles.divider} />
      
      <div className={styles.metric}>
        <span className={styles.icon}>🤖</span>
        <span className={styles.label}>AI Resolution:</span>
        <span className={`${styles.value} ${styles.highlight}`}>
          {metrics.aiResolutionRate}%
        </span>
      </div>

      <div className={styles.spacer} />

      <div className={styles.status}>
        <span className={styles.statusDot} />
        <span className={styles.statusText}>System Online</span>
      </div>
    </footer>
  );
}

