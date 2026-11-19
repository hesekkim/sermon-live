import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
} from 'react';
import { FiHeadphones, FiMoon, FiSun } from 'react-icons/fi';
import styles from './Listen.module.css';
import { ScripturePopup } from './ScripturePopup/ScripturePopup';
import { getListenerCopy } from './translations';
import { useListenAudio, type ScripturePassage } from './useListenAudio';
import { useListenerPreferences } from './useListenerPreferences';
import { useScreenWakeLock } from './useScreenWakeLock';

type RetryState =
  | 'initialRetrying'
  | 'timedOutRetrying'
  | 'serverRetrying'
  | 'reconnecting';

function isRetryState(state: string): state is RetryState {
  return (
    state === 'initialRetrying' ||
    state === 'timedOutRetrying' ||
    state === 'serverRetrying' ||
    state === 'reconnecting'
  );
}

export default function Listen() {
  const {
    audioError,
    audioOutputReady,
    audioRecoveryRequired,
    canStartListening,
    connectionState,
    dismissScripture,
    interpreterReconnecting,
    isListening,
    recoverAudio,
    sessionEnded,
    sessionKey,
    sessionStatus,
    scripture,
    stopListening,
    startListening,
    subtitle,
    subtitleLines,
    translationTargetLanguage,
  } = useListenAudio();
  const { fontSize, setFontSize, setTheme, theme } = useListenerPreferences();
  const copy = getListenerCopy(translationTargetLanguage);
  const screenWakeLockStatus = useScreenWakeLock(
    isListening && sessionStatus === 'live' && !sessionEnded,
  );
  const screenWakeLockMessage =
    screenWakeLockStatus === 'insecure'
      ? copy.wakeLock.insecure
      : screenWakeLockStatus === 'unsupported'
        ? copy.wakeLock.unsupported
        : screenWakeLockStatus === 'requestFailed'
          ? copy.wakeLock.requestFailed
          : screenWakeLockStatus === 'released'
            ? copy.wakeLock.released
            : '';
  const [scriptureCards, setScriptureCards] = useState<ScripturePassage[]>([]);
  useLayoutEffect(() => {
    if (subtitleLines.length === 0) return;
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, [subtitleLines]);
  useEffect(() => {
    setScriptureCards([]);
  }, [sessionKey]);
  useEffect(() => {
    if (scripture) setScriptureCards((current) => [scripture, ...current]);
  }, [scripture]);
  const scriptureCardsForDisplay = scriptureCards;
  const dismissTopScriptureCard = () => {
    dismissScripture();
    setScriptureCards((current) => current.slice(1));
  };
  const dismissAllScriptureCards = () => {
    dismissScripture();
    setScriptureCards([]);
  };
  const isRetrying = isRetryState(connectionState);
  const audioOutputPending = isListening && !audioOutputReady;
  const statusLabel = isRetrying
    ? copy.retry[connectionState]
    : connectionState === 'connecting'
      ? copy.status.connecting
        : sessionEnded
          ? copy.status.ended
          : sessionStatus === 'live'
            ? audioRecoveryRequired
              ? copy.status.audioRecoveryRequired
              : interpreterReconnecting
                ? copy.status.interpreterReconnecting
                : audioOutputPending
                  ? copy.status.audioOutputPending
                  : subtitle
                    ? copy.status.live
                    : copy.status.waitingForTranslation
            : sessionStatus === 'starting'
              ? copy.status.starting
              : sessionStatus === 'stopping'
                ? copy.status.stopping
                : sessionStatus === 'error'
                  ? copy.status.unavailable
                  : sessionStatus === 'off'
                    ? connectionState === 'connected'
                      ? copy.status.connectedOff
                      : copy.status.off
                    : copy.status.waitingForStart;
  const subtitlePlaceholder =
    sessionStatus === 'live'
      ? copy.placeholder.live
      : sessionStatus === 'off'
        ? copy.placeholder.off
        : copy.placeholder.waiting;
  const badgeStateClass =
    connectionState === 'connecting' ||
    connectionState === 'initialRetrying' ||
    connectionState === 'timedOutRetrying' ||
    connectionState === 'serverRetrying' ||
    connectionState === 'reconnecting'
      ? styles[connectionState]
    : (audioRecoveryRequired || audioOutputPending) &&
        sessionStatus === 'live'
        ? styles.reconnecting
        : sessionEnded || sessionStatus === 'off' || sessionStatus === 'error'
          ? styles.inactive
          : '';
  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <h1>Sermon Live</h1>
        {sessionEnded ? null : (
          <div
            className={`${styles.sessionBadge} ${badgeStateClass}`}
            role="status"
            aria-live="polite"
          >
            <span className={styles.statusDot} />
            {statusLabel}
          </div>
        )}
        <button
          type="button"
          className={styles.themeButton}
          aria-label={
            theme === 'light' ? copy.changeToDark : copy.changeToLight
          }
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? (
            <FiMoon aria-hidden="true" />
          ) : (
            <FiSun aria-hidden="true" />
          )}
        </button>
      </header>

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
        {scriptureCardsForDisplay.length > 0 ? (
          <ScripturePopup
            scriptures={scriptureCardsForDisplay}
            onDismiss={dismissTopScriptureCard}
            onDismissAll={dismissAllScriptureCards}
            dismissLabel={copy.dismissScripture}
            dismissText={copy.dismissScriptureButton}
          />
        ) : null}
      </section>

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
                void recoverAudio();
              } else if (isListening) {
                stopListening();
              } else {
                void startListening();
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
          <div
            className={styles.fontControl}
            role="group"
            aria-label={copy.fontSize}
          >
            <button
              type="button"
              aria-label={copy.smallerText}
              aria-pressed={fontSize === 16}
              onClick={() => setFontSize(16)}
            >
              <span className={styles.smallA}>A</span>
            </button>
            <button
              type="button"
              aria-label={copy.defaultTextSize}
              aria-pressed={fontSize === 20}
              onClick={() => setFontSize(20)}
            >
              <span className={styles.mediumA}>A</span>
            </button>
            <button
              type="button"
              aria-label={copy.largerText}
              aria-pressed={fontSize === 24}
              onClick={() => setFontSize(24)}
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
          </div>
        ) : null}
        <div className={styles.powered}>POWERED BY CHURCHTRANSLATOR.AT</div>
      </footer>
    </main>
  );
}
