import type { CSSProperties } from 'react';
import type { ScripturePassage } from '../useListenAudio';
import styles from './ScripturePopup.module.css';
import { useScripturePopup } from './useScripturePopup';

interface ScripturePopupProps {
  scriptures: ScripturePassage[];
  onDismiss: () => void;
  onDismissAll: () => void;
}

export function ScripturePopup({
  scriptures,
  onDismiss,
  onDismissAll,
}: ScripturePopupProps) {
  const {
    handleDismiss,
    handleKeyDown,
    scriptureDismissing,
  } = useScripturePopup(scriptures, onDismiss, onDismissAll);

  return (
    <div className={styles.scripturePopup}>
      <div className={styles.scriptureCardStack}>
        {scriptures.map((scripture, index) => {
          const isInteractive = index === 0;
          return (
            <aside
              key={`${scripture.reference}-${index}`}
              className={[
                styles.scripture,
                isInteractive ? '' : styles.scriptureBack,
                isInteractive && scriptureDismissing
                  ? styles.scriptureDismissing
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role={isInteractive ? 'button' : undefined}
              tabIndex={isInteractive ? 0 : -1}
              aria-hidden={isInteractive ? undefined : true}
              aria-label={isInteractive ? 'Bibeltext schließen' : undefined}
              aria-live={isInteractive ? 'polite' : undefined}
              style={
                {
                  '--scripture-stack-offset': `${Math.min(index * 20, 72)}px`,
                  '--scripture-stack-z': scriptures.length - index,
                } as CSSProperties
              }
              onClick={isInteractive ? handleDismiss : undefined}
              onKeyDown={isInteractive ? handleKeyDown : undefined}
            >
              <header className={styles.scriptureHeader}>
                <strong className={styles.scriptureReference}>
                  {scripture.reference}
                </strong>
                <span className={styles.scriptureVersion}>
                  {scripture.version}
                </span>
              </header>
              <div className={styles.scriptureVerses}>
                {scripture.verses.map((verse) => (
                  <p className={styles.scriptureVerse} key={verse.verse}>
                    <sup className={styles.verseNumber}>{verse.verse}</sup>
                    {verse.text}
                  </p>
                ))}
              </div>
            </aside>
          );
        })}
      </div>
    </div>
  );
}
