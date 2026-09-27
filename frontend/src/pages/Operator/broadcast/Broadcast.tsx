import { useOutletContext } from 'react-router-dom';
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import { useOperatorPrefs } from '../OperatorPrefs';
import TranscriptPane from './components/TranscriptPane';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const outletContext = useOutletContext<OperatorOutletContext | null>();
  const showInputPane = outletContext?.showInputPane ?? true;
  const { labels } = useOperatorPrefs();
  const inputLines = outletContext?.inputLines ?? [];
  const outputLines = outletContext?.outputLines ?? [];

  return (
    <div className={styles.page}>
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
