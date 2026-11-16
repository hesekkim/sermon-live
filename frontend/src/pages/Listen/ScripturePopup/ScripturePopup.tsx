import type { CSSProperties } from 'react';
import { FiX } from 'react-icons/fi';
import type { ScripturePassage } from '../useListenAudio';
import styles from './ScripturePopup.module.css';
import { useScripturePopup } from './useScripturePopup';

interface ScripturePopupProps {
  scriptures: ScripturePassage[];
  onDismiss: () => void;
  onDismissAll: () => void;
  dismissLabel: string;
  dismissText: string;
}

export function ScripturePopup({
  scriptures,
  onDismiss,
  onDismissAll,
  dismissLabel,
  dismissText,
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
              aria-hidden={isInteractive ? undefined : true}
              aria-live={isInteractive ? 'polite' : undefined}
              style={
                {
                  '--scripture-stack-offset': `${Math.min(index * 20, 72)}px`,
                  '--scripture-stack-z': scriptures.length - index,
                } as CSSProperties
              }
              onClick={isInteractive ? handleDismiss : undefined}
            >
              <header className={styles.scriptureHeader}>
                <strong className={styles.scriptureReference}>
                  {scripture.reference}
                </strong>
                <span className={styles.scriptureVersion}>
                  {scripture.version}
                </span>
                {isInteractive ? (
                  <button
                    type="button"
                    className={styles.scriptureDismissButton}
                    aria-label={dismissLabel}
                    title={dismissLabel}
                    onKeyDown={handleKeyDown}
                  >
                    <FiX aria-hidden="true" />
                    <span>{dismissText}</span>
                  </button>
                ) : null}
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
