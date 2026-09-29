import { Link, Outlet } from 'react-router-dom';
import {
  LuLogOut,
  LuMoon,
  LuPower,
  LuPowerOff,
  LuSettings,
  LuSun,
} from 'react-icons/lu';
import { useRef } from 'react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import Sidebar from '../../../shared/components/Sidebar/Sidebar';
import BroadcastHeader from '../broadcast/components/BroadcastHeader';
import { useBroadcastSession } from '../broadcast/hooks/useBroadcastSession';
import { useBroadcastToggle } from '../broadcast/hooks/useBroadcastToggle';
import { useOperatorPrefs } from '../OperatorPrefs';
import { useOperatorLayout } from './useOperatorLayout';
import ListenQrShare from './ListenQrShare';
import styles from './OperatorLayout.module.css';

export interface OperatorOutletContext {
  audioLevel: number | null;
  audioLevelStale: boolean;
  isSessionBusy: boolean;
  showInputPane: boolean;
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
  const session = useBroadcastSession(labels, (message) => {
    sessionErrorDuringAttemptRef.current = true;
    toastError(message);
  });
  const actions = useBroadcastToggle({
    labels,
    sessionStatus: session.sessionStatus,
    start: session.start,
    stop: session.stop,
    extend: session.extend,
    sessionErrorDuringAttemptRef,
  });
  const { showInputPane } = useOperatorLayout();
  const isLive = session.sessionStatus === 'live';
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
                inputLines: session.inputLines,
                outputLines: session.outputLines,
              } satisfies OperatorOutletContext
            }
          />
        </div>
      </main>
    </div>
  );
}
