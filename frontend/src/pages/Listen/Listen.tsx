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

type ListenerLanguage = 'de' | 'en' | 'ko';
type RetryState =
  | 'initialRetrying'
  | 'timedOutRetrying'
  | 'serverRetrying'
  | 'reconnecting';

const LISTENER_COPY = {
  de: {
    retry: {
      initialRetrying: 'ERSTVERBINDUNG FEHLGESCHLAGEN · NEUER VERSUCH',
      timedOutRetrying: 'VERBINDUNGSZEITÜBERSCHREITUNG · NEUER VERSUCH',
      serverRetrying: 'SERVER HAT DIE VERBINDUNG BEENDET · NEUER VERSUCH',
      reconnecting: 'VERBINDUNG UNTERBROCHEN · VERBINDET ERNEUT',
    },
    status: {
      connecting: 'VERBINDET...',
      ended: 'SENDUNG BEENDET · DEUTSCH',
      interpreterReconnecting: 'ÜBERSETZUNG WIRD WIEDERHERGESTELLT',
      live: 'SESSION LIVE · DEUTSCH',
      waitingForTranslation: 'WARTEN AUF ÜBERSETZUNG',
      starting: 'ÜBERSETZUNG STARTET',
      stopping: 'SENDUNG WIRD BEENDET',
      unavailable: 'ÜBERSETZUNG NICHT VERFÜGBAR',
      connectedOff: 'VERBUNDEN · ÜBERSETZUNG AUS',
      off: 'ÜBERSETZUNG AUS',
      waitingForStart: 'WARTEN AUF SENDUNGSSTART',
    },
    placeholder: {
      live: 'Warten auf Übersetzung...',
      off: 'Die Übersetzung ist ausgeschaltet.',
      waiting: 'Die Übersetzung erscheint hier.',
    },
    changeToDark: 'Dunkles Design aktivieren',
    changeToLight: 'Helles Design aktivieren',
    transcript: 'Deutsche Übersetzung',
    ended: 'Sendung beendet',
    startListening: 'anhören',
    stopListening: 'stoppen',
    resumeAudio: 'Audio fortsetzen',
    fontSize: 'Schriftgröße',
    smallerText: 'Kleinerer Text',
    defaultTextSize: 'Standardgröße',
    largerText: 'Größerer Text',
    recoveryMessage:
      'Die Audiowiedergabe wurde unterbrochen. Tippen Sie auf „anhören“, um sie fortzusetzen.',
    recoveryFailed: 'Audio konnte nicht fortgesetzt werden',
    dismissScripture: 'Bibeltext schließen',
  },
  en: {
    retry: {
      initialRetrying: 'Initial connection failed · retrying',
      timedOutRetrying: 'Connection timed out · retrying',
      serverRetrying: 'Server closed the connection · retrying',
      reconnecting: 'Connection lost · reconnecting',
    },
    status: {
      connecting: 'CONNECTING...',
      ended: 'BROADCAST ENDED · GERMAN',
      interpreterReconnecting: 'TRANSLATION RECONNECTING',
      live: 'SESSION LIVE · GERMAN',
      waitingForTranslation: 'WAITING FOR TRANSLATION',
      starting: 'STARTING TRANSLATION',
      stopping: 'ENDING BROADCAST',
      unavailable: 'TRANSLATION UNAVAILABLE',
      connectedOff: 'CONNECTED · TRANSLATION OFF',
      off: 'TRANSLATION OFF',
      waitingForStart: 'WAITING FOR BROADCAST',
    },
    placeholder: {
      live: 'Waiting for translation...',
      off: 'Translation is off.',
      waiting: 'The translation will appear here.',
    },
    changeToDark: 'Change to dark theme',
    changeToLight: 'Change to light theme',
    transcript: 'German translation',
    ended: 'Broadcast ended',
    startListening: 'Start listening',
    stopListening: 'Stop listening',
    resumeAudio: 'Resume audio',
    fontSize: 'Font size',
    smallerText: 'Smaller text',
    defaultTextSize: 'Default text size',
    largerText: 'Larger text',
    recoveryMessage:
      'Audio playback stopped. Tap “Start listening” to resume listening.',
    recoveryFailed: 'Audio could not be resumed',
    dismissScripture: 'Close Bible passage',
  },
  ko: {
    retry: {
      initialRetrying: '최초 연결 실패 · 다시 연결 중',
      timedOutRetrying: '연결 시간 초과 · 다시 연결 중',
      serverRetrying: '서버 연결 종료 · 다시 연결 중',
      reconnecting: '연결 끊김 · 다시 연결 중',
    },
    status: {
      connecting: '연결 중...',
      ended: '방송 종료 · 독일어',
      interpreterReconnecting: '통역 다시 연결 중',
      live: '방송 중 · 독일어',
      waitingForTranslation: '통역 대기 중',
      starting: '통역 시작 중',
      stopping: '방송 종료 중',
      unavailable: '통역을 사용할 수 없음',
      connectedOff: '연결됨 · 통역 꺼짐',
      off: '통역 꺼짐',
      waitingForStart: '방송 시작 대기 중',
    },
    placeholder: {
      live: '통역을 기다리는 중...',
      off: '통역이 꺼져 있습니다.',
      waiting: '통역 내용이 여기에 표시됩니다.',
    },
    changeToDark: '어두운 테마로 변경',
    changeToLight: '밝은 테마로 변경',
    transcript: '독일어 통역',
    ended: '방송 종료',
    startListening: '듣기',
    stopListening: '듣기 중지',
    resumeAudio: '오디오 다시 시작',
    fontSize: '글자 크기',
    smallerText: '글자 작게',
    defaultTextSize: '기본 글자 크기',
    largerText: '글자 크게',
    recoveryMessage:
      '오디오 재생이 중단되었습니다. 듣기 버튼을 눌러 다시 시작하세요.',
    recoveryFailed: '오디오를 다시 재생할 수 없습니다',
    dismissScripture: '성경 본문 닫기',
  },
} as const;

function getListenerLanguage(): ListenerLanguage {
  const language = navigator.language.split('-')[0].toLowerCase();
  return language === 'de' || language === 'ko' ? language : 'en';
}

function isRetryState(state: string): state is RetryState {
  return (
    state === 'initialRetrying' ||
    state === 'timedOutRetrying' ||
    state === 'serverRetrying' ||
    state === 'reconnecting'
  );
}

export default function Listen() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const {
    audioError,
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
  } = useListenAudio();
  const { fontSize, setFontSize, setTheme, theme } = useListenerPreferences();
  const copy = LISTENER_COPY[getListenerLanguage()];
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
  const statusLabel = isRetrying
    ? copy.retry[connectionState]
    : connectionState === 'connecting'
      ? copy.status.connecting
        : sessionEnded
          ? copy.status.ended
          : sessionStatus === 'live'
            ? interpreterReconnecting
              ? copy.status.interpreterReconnecting
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
        {scriptureCardsForDisplay.length > 0 ? (
          <ScripturePopup
            scriptures={scriptureCardsForDisplay}
            onDismiss={dismissTopScriptureCard}
            onDismissAll={dismissAllScriptureCards}
            dismissLabel={copy.dismissScripture}
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
              {isListening && !audioRecoveryRequired
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
        {audioRecoveryRequired && (
          <div className={styles.audioRecovery} role="alert">
            <p>{copy.recoveryMessage}</p>
          </div>
        )}
        {audioError && (
          <p className={styles.audioError}>
            {copy.recoveryFailed}: {audioError}
          </p>
        )}
        <div className={styles.powered}>POWERED BY CHURCHTRANSLATOR.AT</div>
      </footer>
    </main>
  );
}
