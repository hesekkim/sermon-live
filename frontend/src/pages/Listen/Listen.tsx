import type { CSSProperties } from 'react';
import { FiChevronDown, FiGlobe, FiHeadphones, FiMoon, FiSun } from 'react-icons/fi';
import styles from './Listen.module.css';
import { useListenAudio } from './useListenAudio';
import { useListenerPreferences } from './useListenerPreferences';

export default function Listen() {
  const {
    audioError,
    connectionState,
    isListening,
    sessionEnded,
    sessionStatus,
    startListening,
    subtitle,
  } = useListenAudio();
  const { fontSize, setFontSize, setTheme, theme } = useListenerPreferences();
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
                    : 'BEREIT ZUM HÖREN';
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
        <h1>Demo</h1>
        <div
          className={`${styles.sessionBadge} ${badgeStateClass}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.statusDot} />
          {statusLabel}
        </div>
        <button
          type="button"
          className={styles.themeButton}
          aria-label={theme === 'light' ? 'Change to dark theme' : 'Change to light theme'}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <FiMoon aria-hidden="true" /> : <FiSun aria-hidden="true" />}
        </button>
      </header>

      <section className={styles.transcript} aria-label="German translation">
        <p
          className={subtitle ? styles.subtitle : `${styles.subtitle} ${styles.placeholder}`}
          style={{ '--subtitle-font-size': `${fontSize}px` } as CSSProperties}
          aria-live="polite"
        >
          {sessionEnded
            ? 'Die Sendung ist beendet.'
            : subtitle || subtitlePlaceholder}
        </p>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerToolbar}>
          <button
            type="button"
            className={styles.listenButton}
            aria-label={isListening ? 'Listening' : 'Listen'}
            onClick={() => void startListening()}
            disabled={isListening}
          >
            <FiHeadphones aria-hidden="true" />
            <span>{isListening ? 'wird angehört' : 'anhören'}</span>
          </button>
          <div className={styles.fontControl} role="group" aria-label="Schriftgröße">
            <button
              type="button"
              aria-label="Smaller text"
              aria-pressed={fontSize === 20}
              onClick={() => setFontSize(20)}
            >
              <span className={styles.smallA}>A</span>
            </button>
            <button
              type="button"
              aria-label="Default text size"
              aria-pressed={fontSize === 24}
              onClick={() => setFontSize(24)}
            >
              <span className={styles.mediumA}>A</span>
            </button>
            <button
              type="button"
              aria-label="Larger text"
              aria-pressed={fontSize === 32}
              onClick={() => setFontSize(32)}
            >
              <span className={styles.largeA}>A</span>
            </button>
          </div>
          <div className={styles.languageDisplay} aria-label="Subtitle language: Deutsch">
            <FiGlobe aria-hidden="true" />
            <FiChevronDown aria-hidden="true" />
          </div>
        </div>
        {audioError && <p className={styles.audioError}>{audioError}</p>}
        <div className={styles.powered}>POWERED BY CHURCHTRANSLATOR.AT</div>
      </footer>
    </main>
  );
}
