import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { FiHeadphones, FiMoon, FiSun } from 'react-icons/fi';
import styles from './Listen.module.css';
import { ScripturePopup } from './ScripturePopup/ScripturePopup';
import { useListenAudio, type ScripturePassage } from './useListenAudio';
import { useListenerPreferences } from './useListenerPreferences';

export default function Listen() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const {
    audioError,
    canStartListening,
    connectionState,
    dismissScripture,
    isListening,
    sessionEnded,
    sessionStatus,
    scripture,
    stopListening,
    startListening,
    subtitle,
    subtitleLines,
  } = useListenAudio();
  const { fontSize, setFontSize, setTheme, theme } = useListenerPreferences();
  const [scriptureCards, setScriptureCards] = useState<ScripturePassage[]>([]);
  useLayoutEffect(() => {
    if (subtitleLines.length === 0) return;
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, [subtitleLines]);
  useEffect(() => {
    if (!isListening || !('wakeLock' in navigator)) return;
    let disposed = false;
    let requestPending = false;

    const requestWakeLock = async () => {
      if (disposed || document.visibilityState !== 'visible' || requestPending) {
        return;
      }
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      wakeLockRef.current = null;
      requestPending = true;
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        if (disposed) {
          await wakeLock.release();
          return;
        }
        wakeLockRef.current = wakeLock;
        wakeLock.addEventListener(
          'release',
          () => {
            if (wakeLockRef.current === wakeLock) wakeLockRef.current = null;
          },
          { once: true },
        );
      } catch {
        wakeLockRef.current = null;
      } finally {
        requestPending = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const wakeLock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (wakeLock && !wakeLock.released) void wakeLock.release();
    };
  }, [isListening]);
  useEffect(() => {
    if (sessionStatus === 'starting') setScriptureCards([]);
  }, [sessionStatus]);
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
  const statusLabel =
    connectionState === 'connecting'
      ? 'VERBINDET...'
      : connectionState === 'reconnecting'
        ? 'VERBINDUNG UNTERBROCHEN · VERBINDET ERNEUT'
        : sessionEnded
          ? 'SENDUNG BEENDET · DEUTSCH'
          : sessionStatus === 'live'
            ? subtitle
              ? 'SESSION LIVE · DEUTSCH'
              : 'WARTEN AUF ÜBERSETZUNG'
            : sessionStatus === 'starting'
              ? 'ÜBERSETZUNG STARTET'
              : sessionStatus === 'stopping'
                ? 'SENDUNG WIRD BEENDET'
                : sessionStatus === 'error'
                  ? 'ÜBERSETZUNG NICHT VERFÜGBAR'
                  : sessionStatus === 'off'
                    ? connectionState === 'connected'
                      ? 'VERBUNDEN · ÜBERSETZUNG AUS'
                      : 'ÜBERSETZUNG AUS'
                    : 'WARTEN AUF SENDUNGSSTART';
  const subtitlePlaceholder =
    sessionStatus === 'live'
      ? 'Warten auf Übersetzung...'
      : sessionStatus === 'off'
        ? 'Die Übersetzung ist ausgeschaltet.'
        : 'Die Übersetzung erscheint hier.';
  const badgeStateClass =
    connectionState === 'connecting' || connectionState === 'reconnecting'
      ? styles[connectionState]
      : sessionEnded || sessionStatus === 'off' || sessionStatus === 'error'
        ? styles.inactive
        : '';

  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.header}>
        <h1>Seanuree Live</h1>
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
            theme === 'light' ? 'Change to dark theme' : 'Change to light theme'
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

      <section className={styles.transcript} aria-label="German translation">
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
        {scriptureCardsForDisplay.length > 0 ? (
          <ScripturePopup
            scriptures={scriptureCardsForDisplay}
            onDismiss={dismissTopScriptureCard}
            onDismissAll={dismissAllScriptureCards}
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
                ? 'Sendung beendet'
                : isListening
                  ? 'Stop listening'
                  : 'Start listening'
            }
            title={sessionEnded ? 'Sendung beendet' : undefined}
            onClick={() =>
              isListening ? stopListening() : void startListening()
            }
            disabled={!isListening && !canStartListening}
          >
            <FiHeadphones aria-hidden="true" />
            <span>{isListening ? 'stoppen' : 'anhören'}</span>
          </button>
          <div
            className={styles.fontControl}
            role="group"
            aria-label="Schriftgröße"
          >
            <button
              type="button"
              aria-label="Smaller text"
              aria-pressed={fontSize === 16}
              onClick={() => setFontSize(16)}
            >
              <span className={styles.smallA}>A</span>
            </button>
            <button
              type="button"
              aria-label="Default text size"
              aria-pressed={fontSize === 20}
              onClick={() => setFontSize(20)}
            >
              <span className={styles.mediumA}>A</span>
            </button>
            <button
              type="button"
              aria-label="Larger text"
              aria-pressed={fontSize === 24}
              onClick={() => setFontSize(24)}
            >
              <span className={styles.largeA}>A</span>
            </button>
          </div>
        </div>
        {audioError && <p className={styles.audioError}>{audioError}</p>}
        <div className={styles.powered}>POWERED BY CHURCHTRANSLATOR.AT</div>
      </footer>
    </main>
  );
}
