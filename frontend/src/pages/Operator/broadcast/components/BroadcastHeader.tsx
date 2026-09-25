import { LuPower, LuPowerOff } from 'react-icons/lu';
import AudioLevelMeter from '../../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import type { OperatorCopy } from '../../translations';
import type {
  InterpreterStatus,
  OperatorConnectionStatus,
  ServerStatus,
  SessionTimerState,
  TranslationSessionStatus,
} from '../hooks/useBroadcastSession';
import styles from '../Broadcast.module.css';

interface BroadcastHeaderProps {
  labels: OperatorCopy;
  running: boolean;
  sessionStatus: TranslationSessionStatus;
  audioReady: boolean;
  audioError: string | null;
  startAvailable: boolean;
  startBlockReason: string | null;
  sessionError: string | null;
  listenerCount: number;
  audioLevel: number | null;
  latencyMs: number | null;
  serverStatus: ServerStatus;
  operatorConnectionStatus: OperatorConnectionStatus;
  interpreterStatus: InterpreterStatus;
  timer: SessionTimerState | null;
  lastTerminationReason: string | null;
  togglePending: boolean;
  onToggle: () => void;
}

function formatDuration(seconds?: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function BroadcastHeader({
  labels,
  running,
  sessionStatus,
  audioReady,
  audioError,
  startAvailable,
  startBlockReason,
  sessionError,
  listenerCount,
  audioLevel,
  latencyMs,
  serverStatus,
  operatorConnectionStatus,
  interpreterStatus,
  timer,
  lastTerminationReason,
  togglePending,
  onToggle,
}: BroadcastHeaderProps) {
  const serverLabel = {
    connecting: labels.serverConnecting,
    online: labels.serverOnline,
    offline: labels.serverOffline,
  }[serverStatus];
  const interpreterLabel = {
    connected: labels.connectionConnected,
    disconnected: labels.connectionDisconnected,
    error: labels.connectionError,
  }[interpreterStatus];
  const operatorConnectionLabel = {
    connecting: labels.operatorConnecting,
    connected: labels.operatorConnected,
    reconnecting: labels.operatorReconnecting,
  }[operatorConnectionStatus];
  const audioLabel = !audioReady
    ? audioError || labels.audioUnavailable
    : audioLevel !== null && audioLevel > -60
      ? labels.audioSignal
      : labels.audioSilent;
  const translationLabel = {
    off: labels.translationOff,
    starting: labels.translationStarting,
    live: labels.translationLive,
    stopping: labels.translationStopping,
    error: labels.translationError,
  }[sessionStatus];
  const startDisabled = !running && (serverStatus !== 'online' || !startAvailable);
  const disabledReason = serverStatus !== 'online' ? labels.serverOffline : startBlockReason;

  return (
    <>
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
            aria-pressed={sessionStatus === 'live'}
            aria-label={running ? labels.sessionOn : labels.sessionOff}
            title={startDisabled ? disabledReason || labels.sessionOff : running ? labels.sessionOn : labels.sessionOff}
            disabled={togglePending || sessionStatus === 'starting' || sessionStatus === 'stopping' || startDisabled}
            onClick={onToggle}
          >
            {running ? <LuPower size={22} aria-hidden /> : <LuPowerOff size={22} aria-hidden />}
          </button>
        </div>
      </header>
      <section className={styles.statusPanel} aria-label={labels.broadcastStatus}>
        <dl className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <dt>{labels.serverStatus}</dt>
            <dd data-state={serverStatus}>{serverLabel}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.operatorConnection}</dt>
            <dd data-state={operatorConnectionStatus}>{operatorConnectionLabel}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.translationStatus}</dt>
            <dd data-state={sessionStatus}>{translationLabel}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.audioStatus}</dt>
            <dd data-state={audioLabel === labels.audioSignal ? 'live' : 'off'}>{audioLabel}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.latency}</dt>
            <dd>{latencyMs === null ? labels.latencyUnavailable : `${latencyMs} ms`}</dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.interpreterConnection}</dt>
            <dd data-state={interpreterStatus}>{interpreterLabel}</dd>
          </div>
          {timer ? (
            <>
              <div className={styles.statusItem}>
                <dt>{labels.elapsedTime}</dt>
                <dd>{formatDuration(timer.elapsedSeconds)}</dd>
              </div>
              {typeof timer.remainingSeconds === 'number' ? (
                <div className={styles.statusItem}>
                  <dt>{labels.remainingTime}</dt>
                  <dd>{formatDuration(timer.remainingSeconds)}</dd>
                </div>
              ) : null}
              {timer.warning || timer.hardLimitReached ? (
                <div className={styles.statusItem}>
                  <dt>{labels.timerStatus}</dt>
                  <dd data-state="warning">
                    {timer.hardLimitReached ? labels.timerHardLimit : labels.timerWarning}
                  </dd>
                </div>
              ) : null}
              {typeof timer.extensionCount === 'number' ? (
                <div className={styles.statusItem}>
                  <dt>{labels.extensionCount}</dt>
                  <dd>{timer.extensionCount}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {lastTerminationReason ? (
            <div className={styles.statusItem}>
              <dt>{labels.lastTerminationReason}</dt>
              <dd>{lastTerminationReason}</dd>
            </div>
          ) : null}
          {sessionError ? (
            <div className={styles.statusItem}>
              <dt>{labels.sessionErrorLabel}</dt>
              <dd data-state="error">{sessionError}</dd>
            </div>
          ) : null}
          {!running && startBlockReason && (sessionStatus === 'off' || sessionStatus === 'error') ? (
            <div className={styles.statusItem} role="status">
              <dt>{labels.sessionErrorLabel}</dt>
              <dd data-state="warning">{startBlockReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </>
  );
}