import { FiHeadphones } from 'react-icons/fi';
import type { ListenerCopy } from '../translations';
import styles from '../Listen.module.css';

interface ListenerFooterProps {
  audioError: string;
  audioRecoveryRequired: boolean;
  canStartListening: boolean;
  copy: ListenerCopy;
  fontSize: number;
  isListening: boolean;
  sessionEnded: boolean;
  onFontSizeChange: (fontSize: number) => void;
  onRecoverAudio: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  screenWakeLockMessage: string;
}

export function ListenerFooter({
  audioError,
  audioRecoveryRequired,
  canStartListening,
  copy,
  fontSize,
  isListening,
  sessionEnded,
  onFontSizeChange,
  onRecoverAudio,
  onStartListening,
  onStopListening,
  screenWakeLockMessage,
}: ListenerFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerToolbar}>
        <button
          type="button"
          className={styles.listenButton}
          aria-label={
            sessionEnded
              ? copy.ended
              : isListening && !audioRecoveryRequired
                ? copy.stopListening
                : audioRecoveryRequired
                  ? copy.resumeAudio
                  : copy.startListening
          }
          title={sessionEnded ? copy.ended : undefined}
          onClick={() => {
            if (audioRecoveryRequired) {
              onRecoverAudio();
            } else if (isListening) {
              onStopListening();
            } else {
              onStartListening();
            }
          }}
          disabled={!isListening && !canStartListening}
        >
          <FiHeadphones aria-hidden="true" />
          <span>
            {audioRecoveryRequired
              ? copy.resumeAudio
              : isListening
                ? copy.stopListening
                : copy.startListening}
          </span>
        </button>
        <div className={styles.fontControl} role="group" aria-label={copy.fontSize}>
          <button
            type="button"
            aria-label={copy.smallerText}
            aria-pressed={fontSize === 16}
            onClick={() => onFontSizeChange(16)}
          >
            <span className={styles.smallA}>A</span>
          </button>
          <button
            type="button"
            aria-label={copy.defaultTextSize}
            aria-pressed={fontSize === 20}
            onClick={() => onFontSizeChange(20)}
          >
            <span className={styles.mediumA}>A</span>
          </button>
          <button
            type="button"
            aria-label={copy.largerText}
            aria-pressed={fontSize === 24}
            onClick={() => onFontSizeChange(24)}
          >
            <span className={styles.largeA}>A</span>
          </button>
        </div>
      </div>
      {screenWakeLockMessage || audioRecoveryRequired || audioError ? (
        <div className={styles.audioRecovery} role="alert">
          {screenWakeLockMessage ? <p>{screenWakeLockMessage}</p> : null}
          {audioRecoveryRequired || audioError ? (
            <p>{copy.recoveryMessage}</p>
          ) : null}
          {audioError ? <p>{audioError}</p> : null}
        </div>
      ) : null}
      <div className={styles.powered}>POWERED BY CHURCHTRANSLATOR.AT</div>
    </footer>
  );
}
