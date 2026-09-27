import { Link, Outlet } from 'react-router-dom';
import { LuMoon, LuPower, LuPowerOff, LuSettings, LuSun } from 'react-icons/lu';
import { useRef } from 'react';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import Sidebar from '../../../shared/components/Sidebar/Sidebar';
import BroadcastHeader from '../broadcast/components/BroadcastHeader';
import { useBroadcastSession } from '../broadcast/hooks/useBroadcastSession';
import { useBroadcastToggle } from '../broadcast/hooks/useBroadcastToggle';
import { useOperatorPrefs } from '../OperatorPrefs';
import { useOperatorLayout } from './useOperatorLayout';
import styles from './OperatorLayout.module.css';

export interface OperatorOutletContext {
  showInputPane: boolean;
  inputLines: string[];
  outputLines: string[];
}

export default function OperatorLayout() {
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
  const isTransitioning = session.sessionStatus === 'starting' || session.sessionStatus === 'stopping';
  const startDisabled = !isLive && (session.serverStatus !== 'online' || !session.startAvailable);
  const powerLabel = isLive ? labels.sessionOn : labels.sessionOff;
  const powerTitle = startDisabled
    ? session.serverStatus !== 'online' ? labels.serverOffline : session.startBlockReason || powerLabel
    : powerLabel;

  return (
    <div className={`cms-theme ${styles.shell}`}>
      <Sidebar
        brandLabel={labels.brand}
        items={[]}
        ariaLabel={labels.broadcastStatus}
        collapsible={false}
        footer={(
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
        )}
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
          latencyMs={session.latencyMs}
          serverStatus={session.serverStatus}
          operatorConnectionStatus={session.operatorConnectionStatus}
          interpreterStatus={session.interpreterStatus}
          timer={session.timer}
          lastTerminationReason={session.lastTerminationReason}
          actionPending={actions.actionPending}
          onExtend={() => void actions.extendSession()}
          onStopNow={() => void actions.stopNow()}
        />
      </Sidebar>
      <main className={styles.content}>
        <header className={styles.topbar}>
          <div className={styles.topActions}>
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
              {theme === 'dark' ? <LuSun size={20} aria-hidden /> : <LuMoon size={20} aria-hidden />}
            </button>
          </div>
        </header>
        <div className={styles.routeContent}>
          <Outlet
            context={{
              showInputPane,
              inputLines: session.inputLines,
              outputLines: session.outputLines,
            } satisfies OperatorOutletContext}
          />
        </div>
      </main>
    </div>
  );
}
