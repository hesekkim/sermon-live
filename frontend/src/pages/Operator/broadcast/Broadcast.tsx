import { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import { useOperatorPrefs } from '../OperatorPrefs';
import BroadcastHeader from './components/BroadcastHeader';
import TranscriptPane from './components/TranscriptPane';
import { useBroadcastSession } from './hooks/useBroadcastSession';
import { useBroadcastToggle } from './hooks/useBroadcastToggle';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const outletContext = useOutletContext<OperatorOutletContext | null>();
  const showInputPane = outletContext?.showInputPane ?? true;
  const { labels } = useOperatorPrefs();
  const { error: toastError } = useToast();
  const sessionErrorDuringAttemptRef = useRef(false);
  const {
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
    inputLines,
    outputLines,
    start,
    stop,
  } = useBroadcastSession(labels, (message) => {
    sessionErrorDuringAttemptRef.current = true;
    toastError(message);
  });
  const { togglePending, toggleSession } = useBroadcastToggle({
    labels,
    running,
    start,
    stop,
    sessionErrorDuringAttemptRef,
  });

  return (
    <div className={styles.page}>
      <BroadcastHeader
        labels={labels}
        running={running}
        sessionStatus={sessionStatus}
        audioReady={audioReady}
        audioError={audioError}
        startAvailable={startAvailable}
        startBlockReason={startBlockReason}
        sessionError={sessionError}
        listenerCount={listenerCount}
        audioLevel={audioLevel}
        latencyMs={latencyMs}
        serverStatus={serverStatus}
        operatorConnectionStatus={operatorConnectionStatus}
        interpreterStatus={interpreterStatus}
        timer={timer}
        lastTerminationReason={lastTerminationReason}
        togglePending={togglePending}
        onToggle={() => void toggleSession()}
      />
      <div className={showInputPane ? styles.panes : styles.panesSingle}>
        {showInputPane ? (
          <TranscriptPane
            title={labels.inputLabel}
            empty={labels.emptyInput}
            lines={inputLines}
            downloadLabel={labels.inputDownload}
            filename="sermon-input-transcript.txt"
          />
        ) : null}
        <TranscriptPane
          title={labels.outputLabel}
          empty={labels.emptyOutput}
          lines={outputLines}
          downloadLabel={labels.outputDownload}
          filename="sermon-output-transcript.txt"
        />
      </div>
    </div>
  );
}
