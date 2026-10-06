import { Link, Outlet } from 'react-router-dom';
import {
  LuLogOut,
  LuMoon,
  LuPower,
  LuPowerOff,
  LuSettings,
  LuSun,
} from 'react-icons/lu';
import { useRef, useState } from 'react';
import Button from '../../../shared/components/Button/Button';
import Dialog from '../../../shared/components/Dialog/Dialog';
import LoadingSpinner from '../../../shared/components/LoadingSpinner/LoadingSpinner';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import Sidebar from '../../../shared/components/Sidebar/Sidebar';
import BroadcastHeader from '../broadcast/components/BroadcastHeader';
import { useBroadcastSession } from '../broadcast/hooks/useBroadcastSession';
import { useBroadcastToggle } from '../broadcast/hooks/useBroadcastToggle';
import { useOperatorPrefs } from '../OperatorPrefs';
import { useOperatorLayout } from './useOperatorLayout';
import ListenQrShare from './ListenQrShare';
import styles from './OperatorLayout.module.css';
import {
  buildTranscriptPaneDownload,
  downloadTextFile,
} from '../broadcast/utils/transcriptFile';

export interface OperatorOutletContext {
  audioLevel: number | null;
  audioLevelStale: boolean;
  isSessionBusy: boolean;
  showInputPane: boolean;
  inputTranscriptEnabled: boolean;
  setInputTranscriptEnabled: (enabled: boolean) => void;
  inputLines: string[];
  outputLines: string[];
}

export default function OperatorLayout({
  onLogout,
}: {
  onLogout: () => Promise<void>;
}) {
  const { labels, theme, setTheme } = useOperatorPrefs();
  const { error: toastError } = useToast();
  const sessionErrorDuringAttemptRef = useRef(false);
  const pendingStartResolveRef = useRef<((approved: boolean) => void) | null>(
    null,
  );
  const [isTranscriptDialogOpen, setIsTranscriptDialogOpen] = useState(false);
  const session = useBroadcastSession(labels, (message) => {
    sessionErrorDuringAttemptRef.current = true;
    toastError(message);
  });
  const beforeStart = () => {
    if (!session.outputLines.some((line) => line.trim())) {
      return Promise.resolve(true);
    }
    setIsTranscriptDialogOpen(true);
    return new Promise<boolean>((resolve) => {
      pendingStartResolveRef.current = resolve;
    });
  };
  const resolveStart = (approved: boolean) => {
    pendingStartResolveRef.current?.(approved);
    pendingStartResolveRef.current = null;
    setIsTranscriptDialogOpen(false);
  };
  const actions = useBroadcastToggle({
    labels,
    sessionStatus: session.sessionStatus,
    start: session.start,
    beforeStart,
    clearTranscripts: session.clearTranscripts,
    stop: session.stop,
    extend: session.extend,
    sessionErrorDuringAttemptRef,
  });
  const { showInputPane } = useOperatorLayout();
  const isLive = session.sessionStatus === 'live';
  const isStarting =
    actions.isStarting || session.sessionStatus === 'starting';
  const isStopping =
    actions.isStopping || session.sessionStatus === 'stopping';
  const isSessionTransitionLoading = isStarting || isStopping;
  const transitionMessage = isStopping
    ? labels.broadcastStopping
    : labels.broadcastStarting;
  const isTransitioning =
    session.sessionStatus === 'starting' ||
    session.sessionStatus === 'stopping';
  const isSessionBusy = isLive || isTransitioning;
  const startDisabled =
    !isLive && (session.serverStatus !== 'online' || !session.startAvailable);
  const powerLabel = isLive ? labels.sessionOn : labels.sessionOff;
  const powerTitle = startDisabled
    ? session.serverStatus !== 'online'
      ? labels.serverOffline
      : session.startBlockReason || powerLabel
    : powerLabel;
  const handleLogout = async () => {
    try {
      await onLogout();
    } catch {
      toastError(labels.operatorAuthLogoutFailed);
    }
  };

  return (
    <div className={`cms-theme ${styles.shell}`}>
      <Sidebar
        brandLabel={labels.brand}
        items={[]}
        ariaLabel={labels.broadcastStatus}
        collapsible={false}
        footer={
          <Button
            variant={isLive ? 'danger' : 'primary'}
            fullWidth
            icon={isLive ? <LuPowerOff size={18} /> : <LuPower size={18} />}
            aria-pressed={isLive}
            aria-busy={isSessionTransitionLoading}
            title={powerTitle}
            disabled={actions.actionPending || isTransitioning || startDisabled}
            onClick={() => void actions.toggleSession()}
          >
            {powerLabel}
          </Button>
        }
      >
        <BroadcastHeader
          labels={labels}
          sessionStatus={session.sessionStatus}
          audioReady={session.audioReady}
          audioError={session.audioError}
          startBlockReason={session.startBlockReason}
          sessionError={session.sessionError}
          listenerCount={session.listenerCount}
          audioLevel={session.audioLevel}
          audioLevelStale={session.audioLevelStale}
          latencyMs={session.latencyMs}
          serverStatus={session.serverStatus}
          operatorConnectionStatus={session.operatorConnectionStatus}
          interpreterStatus={session.interpreterStatus}
          timer={session.timer}
          lastTerminationReason={session.lastTerminationReason}
          audioDroppedChunks={session.audioDroppedChunks}
          audioDroppedDurationSeconds={session.audioDroppedDurationSeconds}
          actionPending={actions.actionPending}
          onExtend={() => void actions.extendSession()}
          onStopNow={() => void actions.stopNow()}
        />
      </Sidebar>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topActions}>
            <ListenQrShare labels={labels} />
            <Link
              to="/operator/settings"
              className={styles.iconButton}
              aria-label={labels.navSettings}
              title={labels.navSettings}
            >
              <LuSettings size={20} aria-hidden />
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={theme === 'dark' ? labels.lightMode : labels.darkMode}
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? labels.lightMode : labels.darkMode}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <LuSun size={20} aria-hidden />
              ) : (
                <LuMoon size={20} aria-hidden />
              )}
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={labels.operatorAuthLogout}
              title={labels.operatorAuthLogout}
              onClick={() => void handleLogout()}
            >
              <LuLogOut size={20} aria-hidden />
            </button>
          </div>
        </header>
        <div className={styles.routeContent}>
          <Outlet
            context={
              {
                audioLevel: session.audioLevel,
                audioLevelStale: session.audioLevelStale,
                isSessionBusy,
                showInputPane,
                inputTranscriptEnabled: session.inputTranscriptEnabled,
                setInputTranscriptEnabled: session.setInputTranscriptEnabled,
                inputLines: session.inputLines,
                outputLines: session.outputLines,
              } satisfies OperatorOutletContext
            }
          />
        </div>
      </main>
      <Dialog
        isOpen={isTranscriptDialogOpen}
        title={labels.startWithTranscriptTitle}
        closeLabel={labels.cancelStart}
        onClose={() => resolveStart(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => resolveStart(false)}>
              {labels.cancelStart}
            </Button>
            <Button variant="secondary" onClick={() => resolveStart(true)}>
              {labels.discardAndStart}
            </Button>
            <Button
              onClick={() => {
                downloadTextFile(
                  'sermon-output-transcript.txt',
                  buildTranscriptPaneDownload(session.outputLines),
                );
                resolveStart(true);
              }}
            >
              {labels.downloadAndStart}
            </Button>
          </>
        }
      >
        <p>{labels.startWithTranscriptBody}</p>
      </Dialog>
      {isSessionTransitionLoading ? (
        <div
          className={styles.startingOverlay}
          role="status"
          aria-live="polite"
          aria-label={transitionMessage}
        >
          <div className={styles.startingCard}>
            <LoadingSpinner size="large" />
            <span>{transitionMessage}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
