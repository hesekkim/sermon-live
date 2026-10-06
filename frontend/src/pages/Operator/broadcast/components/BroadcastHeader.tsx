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
  startBlockReason: string | null;
  sessionError: string | null;
  listenerCount: number;
  audioLevel: number | null;
  audioLevelStale: boolean;
  latencyMs: number | null;
  serverStatus: ServerStatus;
  operatorConnectionStatus: OperatorConnectionStatus;
  interpreterStatus: InterpreterStatus;
  timer: SessionTimerState | null;
  lastTerminationReason: string | null;
  audioDroppedChunks: number;
  audioDroppedDurationSeconds: number;
  actionPending: boolean;
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
  startBlockReason,
  sessionError,
  listenerCount,
  audioLevel,
  audioLevelStale,
  latencyMs,
  serverStatus,
  operatorConnectionStatus,
  interpreterStatus,
  timer,
  lastTerminationReason,
  audioDroppedChunks,
  audioDroppedDurationSeconds,
  actionPending,
  onExtend,
  onStopNow,
}: BroadcastHeaderProps) {
  const isInvalidApiKey = startBlockReason === labels.invalidApiKey;
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
  const audioLabel = audioReady
    ? labels.inputDeviceReady
    : audioError
      ? `${labels.inputDeviceError}: ${audioError}`
      : labels.inputDeviceUnavailable;
  const translationLabel = {
    off: labels.translationOff,
    starting: labels.translationStarting,
    live: labels.translationLive,
    stopping: labels.translationStopping,
    error: labels.translationError,
  }[sessionStatus];
  const isLive = sessionStatus === 'live';
  const showWarningDialog = Boolean(timer?.warning && isLive);
  const warnTitle = timer?.hardLimitReached
    ? labels.timerHardLimit
    : labels.timerWarningTitle;
  const extensionMinutes = timer?.extensionMinutes;
  const remainingMinutes =
    typeof timer?.remainingSeconds === 'number'
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
      <section
        className={styles.controlSection}
        aria-label={labels.audioTestInputLevel}
      >
        <h2 className={styles.sectionLabel}>{labels.audioTestInputLevel}</h2>
        <div className={styles.levelRow}>
          <AudioLevelMeter
            level={audioLevel}
            label={labels.audioTestInputLevel}
            className={styles.levelMeter}
            isStale={audioLevelStale}
            staleLabel={labels.audioLevelStale}
          />
          {audioLevelStale ? (
            <p className={styles.levelStale} role="status">
              {labels.audioLevelStale}
            </p>
          ) : null}
        </div>
      </section>
      <section className={styles.controlSection} aria-label={labels.listeners}>
        <h2 className={styles.sectionLabel}>{labels.listeners}</h2>
        <p className={styles.listenerCount}>{listenerCount}</p>
      </section>
      <section
        className={styles.statusPanel}
        aria-label={labels.broadcastStatus}
      >
        <h2 className={styles.sectionLabel}>{labels.broadcastStatus}</h2>
        <dl className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <dt>{labels.serverStatus}</dt>
            <dd data-state={serverStatus} title={serverLabel}>
              {serverLabel}
            </dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.operatorConnection}</dt>
            <dd
              data-state={operatorConnectionStatus}
              title={operatorConnectionLabel}
            >
              {operatorConnectionLabel}
            </dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.translationStatus}</dt>
            <dd data-state={sessionStatus} title={translationLabel}>
              {translationLabel}
            </dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.inputDeviceStatus}</dt>
            <dd
              data-state={audioReady ? 'live' : audioError ? 'error' : 'off'}
              title={audioLabel}
            >
              {audioLabel}
            </dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.latency}</dt>
            <dd
              title={
                latencyMs === null
                  ? labels.latencyUnavailable
                  : `${latencyMs} ms`
              }
            >
              {latencyMs === null
                ? labels.latencyUnavailable
                : `${latencyMs} ms`}
            </dd>
          </div>
          <div className={styles.statusItem}>
            <dt>{labels.interpreterConnection}</dt>
            <dd data-state={interpreterStatus} title={interpreterLabel}>
              {interpreterLabel}
            </dd>
          </div>
          {timer ? (
            <>
              {typeof timer.remainingSeconds === 'number' ? (
                <div className={styles.statusItem}>
                  <dt>{labels.remainingTime}</dt>
                  <dd title={formatDuration(timer.remainingSeconds)}>
                    {formatDuration(timer.remainingSeconds)}
                  </dd>
                </div>
              ) : null}
              {timer.warning || timer.hardLimitReached ? (
                <div className={styles.statusItem}>
                  <dt>{labels.timerStatus}</dt>
                  <dd
                    data-state="warning"
                    title={
                      timer.hardLimitReached
                        ? labels.timerHardLimit
                        : labels.timerWarning
                    }
                  >
                    {timer.hardLimitReached
                      ? labels.timerHardLimit
                      : labels.timerWarning}
                  </dd>
                </div>
              ) : null}
              {typeof timer.extensionCount === 'number' ? (
                <div className={styles.statusItem}>
                  <dt>{labels.extensionCount}</dt>
                  <dd title={String(timer.extensionCount)}>
                    {timer.extensionCount}
                  </dd>
                </div>
              ) : null}
            </>
          ) : null}
          {lastTerminationReason ? (
            <div className={styles.statusItem}>
              <dt>{labels.lastTerminationReason}</dt>
              <dd title={lastTerminationReason}>{lastTerminationReason}</dd>
            </div>
          ) : null}
          {audioDroppedChunks > 0 ? (
            <>
              <div className={styles.statusItem} role="status">
                <dt>{labels.audioQueueWarning}</dt>
                <dd data-state="warning" title={labels.audioQueueWarning}>
                  {labels.audioQueueWarning}
                </dd>
              </div>
              <div className={styles.statusItem}>
                <dt>{labels.audioQueueLoss}</dt>
                <dd
                  title={`${audioDroppedChunks} / ${audioDroppedDurationSeconds.toFixed(1)}`}
                >
                  {labels.audioQueueLossDetails
                    .replace('{chunks}', String(audioDroppedChunks))
                    .replace(
                      '{seconds}',
                      audioDroppedDurationSeconds.toFixed(1),
                    )}
                </dd>
              </div>
            </>
          ) : null}
          {sessionError ? (
            <div className={styles.statusItem}>
              <dt>{labels.sessionErrorLabel}</dt>
              <dd data-state="error" title={sessionError}>
                {sessionError}
              </dd>
            </div>
          ) : null}
          {!isLive &&
          startBlockReason &&
          (sessionStatus === 'off' || sessionStatus === 'error') ? (
            <div
              className={styles.statusItem}
              role={isInvalidApiKey ? 'alert' : 'status'}
            >
              <dt>{labels.sessionErrorLabel}</dt>
              <dd
                data-state={isInvalidApiKey ? 'error' : 'warning'}
                title={startBlockReason}
              >
                {startBlockReason}
              </dd>
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
              {timer?.hardLimitReached
                ? labels.timerHardLimit
                : labels.extendSession}
            </Button>
          </>
        }
      >
        <p className={styles.warningMessage}>{warnBody}</p>
      </Dialog>
    </>
  );
}
