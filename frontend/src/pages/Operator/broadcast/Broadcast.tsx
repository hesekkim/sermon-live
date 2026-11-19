import { useOutletContext } from 'react-router-dom';
import type { OperatorOutletContext } from '../layout/OperatorLayout';
import { useOperatorPrefs } from '../OperatorPrefs';
import TranscriptPane from './components/TranscriptPane';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const outletContext = useOutletContext<OperatorOutletContext | null>();
  const showInputPane =
    (outletContext?.showInputPane ?? true) &&
    (outletContext?.inputTranscriptEnabled ?? false);
  const { labels } = useOperatorPrefs();
  const translationTargetLanguage =
    outletContext?.translationTargetLanguage ?? 'de';
  const outputLanguageLabel =
    translationTargetLanguage === 'en' ? labels.languageEn : labels.languageDe;
  const localizeOutputLabel = (label: string) =>
    label.replace('{language}', outputLanguageLabel);
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
          title={localizeOutputLabel(labels.outputLabel)}
          empty={localizeOutputLabel(labels.emptyOutput)}
          lines={outputLines}
          downloadLabel={localizeOutputLabel(labels.outputDownload)}
          filename="sermon-output-transcript.txt"
          prominent={!showInputPane}
        />
      </div>
    </div>
  );
}
