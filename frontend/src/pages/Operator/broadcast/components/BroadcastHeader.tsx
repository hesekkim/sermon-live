import { LuPower, LuPowerOff } from 'react-icons/lu';
import AudioLevelMeter from '../../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import Button from '../../../../shared/components/Button/Button';
import Dialog from '../../../../shared/components/Dialog/Dialog';
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
  actionPending: boolean;
  onToggle: () => void;
  onExtend: () => void;
  onStopNow: () => void;
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
  actionPending,
  onToggle,
  onExtend,
  onStopNow,
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
  const isLive = sessionStatus === 'live';
  const isTransitioning = sessionStatus === 'starting' || sessionStatus === 'stopping';
  const startDisabled = !isLive && (serverStatus !== 'online' || !startAvailable);
  const disabledReason = serverStatus !== 'online' ? labels.serverOffline : startBlockReason;
  const showWarningDialog = Boolean(timer?.warning && isLive);
  const warnTitle = timer?.hardLimitReached ? labels.timerHardLimit : labels.timerWarningTitle;
  const extensionMinutes = timer?.extensionMinutes;
  const remainingMinutes = typeof timer?.remainingSeconds === 'number'
    ? Math.max(0, Math.ceil(timer.remainingSeconds / 60))
    : 0;
  const warnBody = timer?.hardLimitReached
    ? labels.timerHardLimit
    : typeof extensionMinutes === 'number'
      ? labels.timerWarningBody
        .replace('{remainingMinutes}', String(remainingMinutes))
        .replace('{extensionMinutes}', String(extensionMinutes))
      : labels.timerWarningTitle;

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
            className={[styles.power, isLive ? styles.powerOn : styles.powerOff].join(' ')}
            aria-pressed={isLive}
            aria-label={isLive ? labels.sessionOn : labels.sessionOff}
            title={startDisabled ? disabledReason || labels.sessionOff : isLive ? labels.sessionOn : labels.sessionOff}
            disabled={actionPending || isTransitioning || startDisabled}
            onClick={onToggle}
          >
            {isLive ? <LuPower size={22} aria-hidden /> : <LuPowerOff size={22} aria-hidden />}
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
          {!isLive && startBlockReason && (sessionStatus === 'off' || sessionStatus === 'error') ? (
            <div className={styles.statusItem} role="status">
              <dt>{labels.sessionErrorLabel}</dt>
              <dd data-state="warning">{startBlockReason}</dd>
            </div>
          ) : null}
        </dl>
      </section>
      <Dialog
        isOpen={showWarningDialog}
        title={warnTitle}
        overlayClassName={styles.warningDialogOverlay}
        onClose={() => undefined}
        closeOnOverlayClick={false}
        closeOnEscape={false}
        showFooterDivider={false}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onStopNow}
              disabled={actionPending}
            >
              {labels.stopNow}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onExtend}
              disabled={actionPending || Boolean(timer?.hardLimitReached)}
            >
              {timer?.hardLimitReached ? labels.timerHardLimit : labels.extendSession}
            </Button>
          </>
        }
      >
        <p className={styles.warningMessage}>{warnBody}</p>
      </Dialog>
    </>
  );
}