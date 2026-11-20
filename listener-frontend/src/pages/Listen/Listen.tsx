import styles from './Listen.module.css';
import { AdmissionForm } from './components/AdmissionForm';
import { ListenerFooter } from './components/ListenerFooter';
import { ListenerHeader } from './components/ListenerHeader';
import { ListenerTranscript } from './components/ListenerTranscript';
import { SessionEndedDialog } from './components/SessionEndedDialog';
import {
  getBrowserListenerLanguage,
  getListenerCopy,
} from './translations';
import {
  SESSION_END_LOGOUT_SECONDS,
  useListenAudio,
} from './useListenAudio';
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
    admissionError,
    admissionState,
    audioError,
    audioOutputReady,
    audioRecoveryRequired,
    authenticate,
    canStartListening,
    connectionState,
    dismissScripture,
    interpreterReconnecting,
    isListening,
    recoverAudio,
    sessionEnded,
    sessionInput,
    sessionKey,
    sessionStatus,
    scripture,
    setSessionInput,
    startListening,
    stopListening,
    subtitle,
    subtitleLines,
    translationTargetLanguage,
  } = useListenAudio();
  const { fontSize, setFontSize, setTheme, theme } = useListenerPreferences();
  const copy = getListenerCopy(translationTargetLanguage);
  const admissionCopy = getListenerCopy(
    getBrowserListenerLanguage(navigator.language),
  );
  const screenWakeLockStatus = useScreenWakeLock(
    isListening && sessionStatus === 'live' && !sessionEnded,
  );
  const screenWakeLockMessage =
    screenWakeLockStatus === 'unsupported'
      ? copy.wakeLock.unsupported
      : screenWakeLockStatus === 'requestFailed'
        ? copy.wakeLock.requestFailed
        : screenWakeLockStatus === 'released'
          ? copy.wakeLock.released
          : '';

  if (admissionState !== 'admitted') {
    return (
      <AdmissionForm
        copy={admissionCopy}
        error={admissionError}
        isAuthenticating={admissionState === 'authenticating'}
        onAuthenticate={() => void authenticate()}
        onSessionChange={setSessionInput}
        onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        sessionCode={sessionInput}
        theme={theme}
      />
    );
  }

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
      <ListenerHeader
        badgeStateClass={badgeStateClass}
        copy={copy}
        onThemeChange={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        statusLabel={statusLabel}
        theme={theme}
      />
      <ListenerTranscript
        copy={copy}
        fontSize={fontSize}
        isRetrying={isRetrying}
        onDismissScripture={dismissScripture}
        scripture={scripture}
        sessionKey={sessionKey}
        subtitle={subtitle}
        subtitleLines={subtitleLines}
        subtitlePlaceholder={subtitlePlaceholder}
      />
      <ListenerFooter
        audioError={audioError}
        audioRecoveryRequired={audioRecoveryRequired}
        canStartListening={canStartListening}
        copy={copy}
        fontSize={fontSize}
        isListening={isListening}
        sessionEnded={sessionEnded}
        onFontSizeChange={setFontSize}
        onRecoverAudio={() => void recoverAudio()}
        onStartListening={() => void startListening()}
        onStopListening={stopListening}
        screenWakeLockMessage={screenWakeLockMessage}
      />
      {sessionEnded ? (
        <SessionEndedDialog
          message={copy.sessionEnded.message(SESSION_END_LOGOUT_SECONDS)}
          title={copy.sessionEnded.title}
        />
      ) : null}
    </main>
  );
}
