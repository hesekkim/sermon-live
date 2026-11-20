import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import type { ListenerCopy } from '../translations';
import type { ScripturePassage } from '../useListenAudio';
import { ScripturePopup } from '../ScripturePopup/ScripturePopup';
import styles from '../Listen.module.css';

interface ListenerTranscriptProps {
  copy: ListenerCopy;
  fontSize: number;
  isRetrying: boolean;
  onDismissScripture: () => void;
  scripture: ScripturePassage | null;
  sessionKey: number;
  subtitle: string;
  subtitleLines: string[];
  subtitlePlaceholder: string;
}

export function ListenerTranscript({
  copy,
  fontSize,
  isRetrying,
  onDismissScripture,
  scripture,
  sessionKey,
  subtitle,
  subtitleLines,
  subtitlePlaceholder,
}: ListenerTranscriptProps) {
  const [scriptureCards, setScriptureCards] = useState<ScripturePassage[]>([]);

  useLayoutEffect(() => {
    if (subtitleLines.length > 0) {
      window.scrollTo(0, document.documentElement.scrollHeight);
    }
  }, [subtitleLines]);

  useEffect(() => {
    setScriptureCards([]);
  }, [sessionKey]);

  useEffect(() => {
    if (scripture) setScriptureCards((current) => [scripture, ...current]);
  }, [scripture]);

  const dismissTopScriptureCard = () => {
    onDismissScripture();
    setScriptureCards((current) => current.slice(1));
  };
  const dismissAllScriptureCards = () => {
    onDismissScripture();
    setScriptureCards([]);
  };

  return (
    <section className={styles.transcript} aria-label={copy.transcript}>
      {subtitleLines.length > 0 ? (
        subtitleLines.map((line, index) => (
          <p
            key={`${index}-${line.slice(0, 24)}`}
            className={`${styles.subtitle} ${
              index === subtitleLines.length - 1
                ? styles.subtitleCurrent
                : styles.subtitlePast
            }`}
            style={
              { '--subtitle-font-size': `${fontSize}px` } as CSSProperties
            }
            aria-live="polite"
          >
            {line}
          </p>
        ))
      ) : (
        <p
          className={`${styles.subtitle} ${styles.placeholder}`}
          style={{ '--subtitle-font-size': `${fontSize}px` } as CSSProperties}
          aria-live="polite"
        >
          {subtitle || subtitlePlaceholder}
        </p>
      )}
      {isRetrying ? (
        <p className={styles.connectionHelp} role="note">
          {copy.connectionHelp}
        </p>
      ) : null}
      {scriptureCards.length > 0 ? (
        <ScripturePopup
          scriptures={scriptureCards}
          onDismiss={dismissTopScriptureCard}
          onDismissAll={dismissAllScriptureCards}
          dismissLabel={copy.dismissScripture}
          dismissText={copy.dismissScriptureButton}
        />
      ) : null}
    </section>
  );
}
