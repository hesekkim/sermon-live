import type { TranslationTargetLanguage } from '../../shared/types/translation';

type ListenerLanguage = TranslationTargetLanguage;

export type AdmissionErrorKey =
  | 'missingCredentials'
  | 'invalidCredentials'
  | 'broadcastNotLive'
  | 'rateLimited'
  | 'relayUnavailable'
  | 'relayConfiguration'
  | 'authenticationFailed'
  | 'invalidRelayMessage'
  | 'unsupportedRelayFormat'
  | 'accessExpired'
  | 'accessRejected';

const listenerCopy = {
  de: {
    admission: {
      title: 'Sendung beitreten',
      sessionCode: 'Sendungscode',
      sessionCodeHint:
        'Der Code identifiziert die Sendung, ist aber kein Passwort. Über den geteilten Link wird er automatisch eingetragen.',
      password: 'Zuschauer-Passwort',
      submit: 'Verbinden',
      submitting: 'Wird geprüft...',
      errors: {
        missingCredentials: 'Bitte geben Sie Sendungscode und Passwort ein.',
        invalidCredentials: 'Sendungscode oder Passwort ist nicht korrekt.',
        broadcastNotLive: 'Die Sendung ist derzeit nicht live. Bitte versuchen Sie es später erneut.',
        rateLimited: 'Zu viele Versuche. Bitte warten Sie einen Moment.',
        relayUnavailable: 'Der Berlin-Relay ist vorübergehend nicht erreichbar.',
        relayConfiguration: 'Der Listener-Relay-Endpunkt ist nicht konfiguriert.',
        authenticationFailed: 'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
        invalidRelayMessage: 'Der Berlin-Relay hat eine ungültige Nachricht gesendet.',
        unsupportedRelayFormat: 'Das Audioformat des Berlin-Relays wird nicht unterstützt.',
        accessExpired: 'Ihr Listener-Zugang ist abgelaufen. Bitte geben Sie das Passwort erneut ein.',
        accessRejected: 'Der Listener-Zugang wurde abgelehnt. Bitte geben Sie das Passwort erneut ein.',
      },
    },
    sessionEnded: {
      title: 'Sendung beendet',
      message: (seconds: number) =>
        `Die Sendung wurde beendet. Sie werden in ${seconds} Sekunden abgemeldet.`,
    },
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
      audioRecoveryRequired: 'AUDIOWIEDERGABE UNTERBROCHEN',
      audioOutputPending: 'WARTEN AUF AUDIO',
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
    connectionHelp:
      'Wenn die Verbindung weiterhin fehlschlägt, öffnen Sie diese Seite bitte in einem anderen Browser erneut, zum Beispiel Chrome.',
    wakeLock: {
      unsupported: 'Der Browser unterstützt das Wachhalten des Bildschirms nicht.',
      requestFailed: 'Der Bildschirm konnte nicht wachgehalten werden.',
      released: 'Das Betriebssystem hat die Bildschirmsperre freigegeben.',
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
      'Die Audiowiedergabe wurde unterbrochen. Tippen Sie auf „Audio fortsetzen“, um sie fortzusetzen.',
    dismissScripture: 'Bibeltext schließen',
    dismissScriptureButton: 'Schließen',
  },
  en: {
    admission: {
      title: 'Join broadcast',
      sessionCode: 'Session code',
      sessionCodeHint:
        'This code identifies the broadcast; it is not a password. A shared link fills it in automatically.',
      password: 'Listener password',
      submit: 'Connect',
      submitting: 'Checking...',
      errors: {
        missingCredentials: 'Enter the session code and password.',
        invalidCredentials: 'The session code or password is incorrect.',
        broadcastNotLive: 'The broadcast is not live right now. Please try again later.',
        rateLimited: 'Too many attempts. Wait a moment and try again.',
        relayUnavailable: 'The Berlin relay is temporarily unavailable.',
        relayConfiguration: 'The Listener relay endpoint is not configured.',
        authenticationFailed: 'Listener authentication failed. Try again.',
        invalidRelayMessage: 'The Berlin relay sent an invalid message.',
        unsupportedRelayFormat: 'The Berlin relay audio format is not supported.',
        accessExpired: 'Your Listener access expired. Enter the password again.',
        accessRejected: 'Listener access was rejected. Enter the password again.',
      },
    },
    sessionEnded: {
      title: 'Broadcast ended',
      message: (seconds: number) =>
        `The broadcast has ended. You will be signed out in ${seconds} seconds.`,
    },
    retry: {
      initialRetrying: 'Initial connection failed · retrying',
      timedOutRetrying: 'Connection timed out · retrying',
      serverRetrying: 'Server closed the connection · retrying',
      reconnecting: 'Connection lost · reconnecting',
    },
    status: {
      connecting: 'CONNECTING...',
      ended: 'BROADCAST ENDED · ENGLISH',
      interpreterReconnecting: 'TRANSLATION RECONNECTING',
      audioRecoveryRequired: 'AUDIO PLAYBACK PAUSED',
      audioOutputPending: 'WAITING FOR AUDIO',
      live: 'SESSION LIVE · ENGLISH',
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
    connectionHelp:
      'If the connection keeps failing, try reopening this page in another browser, such as Chrome.',
    wakeLock: {
      unsupported: 'This browser does not support keeping the screen awake.',
      requestFailed: 'The screen could not be kept awake.',
      released: 'The operating system released the screen lock.',
    },
    changeToDark: 'Change to dark theme',
    changeToLight: 'Change to light theme',
    transcript: 'English translation',
    ended: 'Broadcast ended',
    startListening: 'Start listening',
    stopListening: 'Stop listening',
    resumeAudio: 'Resume audio',
    fontSize: 'Font size',
    smallerText: 'Smaller text',
    defaultTextSize: 'Default text size',
    largerText: 'Larger text',
    recoveryMessage:
      'Audio playback stopped. Tap “Resume audio” to continue listening.',
    dismissScripture: 'Close Bible passage',
    dismissScriptureButton: 'Close',
  },
} as const satisfies Record<ListenerLanguage, object>;

export type ListenerCopy = (typeof listenerCopy)[ListenerLanguage];

export function getListenerCopy(language: ListenerLanguage): ListenerCopy {
  return listenerCopy[language];
}

export function getBrowserListenerLanguage(language: string): ListenerLanguage {
  return language.toLowerCase().startsWith('de') ? 'de' : 'en';
}
