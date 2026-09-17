import { useOutletContext } from 'react-router-dom';
import { LiaFileDownloadSolid } from 'react-icons/lia';
import { LuPower, LuPowerOff } from 'react-icons/lu';
import Button from '../../../shared/components/Button/Button';
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import { useOperatorPrefs } from '../OperatorPrefs';
import { buildTranscriptPaneDownload, downloadTextFile } from './transcriptFile';
import { useBroadcastSession } from './useBroadcastSession';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const { showInputPane } = useOutletContext<OperatorOutletContext>();
  const { labels } = useOperatorPrefs();
  const {
    running,
    listenerCount,
    inputLines,
    outputLines,
    error,
    setError,
    start,
    stop,
  } = useBroadcastSession(labels);

  const toggleSession = async () => {
    try {
      if (running) {
        await stop();
      } else {
        await start();
      }
    } catch {
      setError(running ? labels.stopFailed : labels.startFailed);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
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
      {error ? <p className={styles.error}>{error}</p> : null}
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
          variant="text"
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
