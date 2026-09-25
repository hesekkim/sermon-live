import { LuPower, LuPowerOff } from 'react-icons/lu';
import AudioLevelMeter from '../../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import type { OperatorCopy } from '../../translations';
import styles from '../Broadcast.module.css';

interface BroadcastHeaderProps {
  labels: OperatorCopy;
  running: boolean;
  listenerCount: number;
  audioLevel: number | null;
  togglePending: boolean;
  onToggle: () => void;
}

export default function BroadcastHeader({
  labels,
  running,
  listenerCount,
  audioLevel,
  togglePending,
  onToggle,
}: BroadcastHeaderProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.levelWrap}>
        <span className={styles.levelLabel}>Input level</span>
        <AudioLevelMeter level={audioLevel} className={styles.levelMeter} />
      </div>
      <div className={styles.listeners}>
        {labels.listeners}: {listenerCount}
      </div>
      <div className={styles.topActions}>
        <button
          type="button"
          className={[styles.power, running ? styles.powerOn : styles.powerOff].join(' ')}
          aria-pressed={running}
          aria-label={running ? labels.sessionOn : labels.sessionOff}
          title={running ? labels.sessionOn : labels.sessionOff}
          disabled={togglePending}
          onClick={onToggle}
        >
          {running ? <LuPower size={22} aria-hidden /> : <LuPowerOff size={22} aria-hidden />}
        </button>
      </div>
    </header>
  );
}