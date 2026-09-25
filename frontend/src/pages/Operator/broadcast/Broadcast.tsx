import { useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { LiaFileDownloadSolid } from 'react-icons/lia';
import { LuPower, LuPowerOff } from 'react-icons/lu';
import AudioLevelMeter from '../../../shared/components/AudioLevelMeter/AudioLevelMeter';
import Button from '../../../shared/components/Button/Button';
import { useToast } from '../../../shared/components/Toast/ToastProvider';
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import { useOperatorPrefs } from '../OperatorPrefs';
import { buildTranscriptPaneDownload, downloadTextFile } from './transcriptFile';
import { useBroadcastSession } from './useBroadcastSession';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const outletContext = useOutletContext<OperatorOutletContext | null>();
  const showInputPane = outletContext?.showInputPane ?? true;
  const { labels } = useOperatorPrefs();
  const { info, error: toastError } = useToast();
  const [togglePending, setTogglePending] = useState(false);
  const togglePendingRef = useRef(false);
  const sessionErrorDuringAttemptRef = useRef(false);
  const {
    running,
    listenerCount,
    audioLevel,
    inputLines,
    outputLines,
    start,
    stop,
  } = useBroadcastSession(labels, (message) => {
    sessionErrorDuringAttemptRef.current = true;
    toastError(message);
  });

  const toggleSession = async () => {
    if (togglePendingRef.current) {
      return;
    }

    const isStopping = running;
    togglePendingRef.current = true;
    sessionErrorDuringAttemptRef.current = false;
    setTogglePending(true);

    try {
      if (isStopping) {
        await stop();
        info(labels.sessionStopped);
      } else {
        await start();
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (sessionErrorDuringAttemptRef.current) {
          return;
        }
        info(labels.sessionStarted);
      }
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : '';
      const invalidApiKey =
        detail.includes('invalid_api_key') ||
        (detail.toLowerCase().includes('api key') &&
          detail.toLowerCase().includes('not valid'));
      toastError(
        invalidApiKey
          ? labels.invalidApiKey
          : isStopping
            ? labels.stopFailed
            : labels.startFailed
      );
    } finally {
      togglePendingRef.current = false;
      setTogglePending(false);
    }
  };

  return (
    <div className={styles.page}>
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
            className={[
              styles.power,
              running ? styles.powerOn : styles.powerOff,
            ].join(' ')}
            aria-pressed={running}
            aria-label={running ? labels.sessionOn : labels.sessionOff}
            title={running ? labels.sessionOn : labels.sessionOff}
            disabled={togglePending}
            onClick={() => void toggleSession()}
          >
            {running ? (
              <LuPower size={22} aria-hidden />
            ) : (
              <LuPowerOff size={22} aria-hidden />
            )}
          </button>
        </div>
      </header>
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

function TranscriptPane({
  title,
  empty,
  lines,
  downloadLabel,
  filename,
}: {
  title: string;
  empty: string;
  lines: string[];
  downloadLabel: string;
  filename: string;
}) {
  return (
    <section className={styles.pane}>
      <div className={styles.paneHeader}>
        <h2>{title}</h2>
        <Button
          variant="ghost"
          icon={<LiaFileDownloadSolid size={20} />}
          aria-label={downloadLabel}
          title={downloadLabel}
          onClick={() =>
            downloadTextFile(filename, buildTranscriptPaneDownload(lines))
          }
        />
      </div>
      <div className={styles.scroll}>
        {lines.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          lines.map((line, index) => (
            <p
              key={`${index}-${line.slice(0, 24)}`}
              className={
                index === lines.length - 1 ? styles.current : styles.past
              }
            >
              {line}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
