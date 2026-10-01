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
    handleKeyDown,
    handleKeyUp,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    scriptureDimmed,
    scriptureDragX,
    scriptureDragging,
    scriptureSwipingOut,
    showScriptureSwipeHint,
  } = useScripturePopup(scriptures, onDismiss, onDismissAll);

  return (
    <div className={styles.scripturePopup}>
      <p
        className={`${styles.scriptureSwipeHint} ${
          showScriptureSwipeHint ? '' : styles.scriptureSwipeHintHidden
        }`}
        aria-hidden={!showScriptureSwipeHint}
      >
        {showScriptureSwipeHint ? (
          <span className={styles.scriptureSwipeHintText}>
            Zum Schließen nach links wischen
          </span>
        ) : null}
      </p>
      <div className={styles.scriptureCardStack}>
        {scriptures.map((scripture, index) => {
          const isInteractive = index === 0;
          return (
            <aside
              key={`${scripture.reference}-${index}`}
              className={[
                styles.scripture,
                isInteractive ? '' : styles.scriptureBack,
                isInteractive && scriptureDimmed ? styles.scriptureDimmed : '',
                isInteractive && scriptureDragging
                  ? styles.scriptureDragging
                  : '',
                isInteractive && scriptureSwipingOut
                  ? styles.scriptureSwipingOut
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              role={isInteractive ? 'button' : undefined}
              tabIndex={isInteractive ? 0 : -1}
              aria-hidden={isInteractive ? undefined : true}
              aria-label={
                isInteractive
                  ? scriptureDimmed
                    ? 'Bibeltext einblenden; nach links wischen zum Schließen'
                    : 'Bibeltext abdunkeln; nach links wischen zum Schließen'
                  : undefined
              }
              aria-live={isInteractive ? 'polite' : undefined}
              style={
                {
                  '--scripture-drag-x': isInteractive
                    ? `${scriptureDragX}px`
                    : '0px',
                  '--scripture-stack-offset': `${Math.min(index * 20, 72)}px`,
                  '--scripture-stack-z': scriptures.length - index,
                } as CSSProperties
              }
              onPointerDown={isInteractive ? handlePointerDown : undefined}
              onPointerMove={isInteractive ? handlePointerMove : undefined}
              onPointerUp={isInteractive ? handlePointerUp : undefined}
              onPointerCancel={isInteractive ? handlePointerCancel : undefined}
              onKeyDown={isInteractive ? handleKeyDown : undefined}
              onKeyUp={isInteractive ? handleKeyUp : undefined}
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
