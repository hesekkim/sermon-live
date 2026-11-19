import type { TranslationTargetLanguage } from '../../shared/types/translation';

type ListenerLanguage = TranslationTargetLanguage;

const listenerCopy = {
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

export function getListenerCopy(language: TranslationTargetLanguage) {
  return listenerCopy[language];
}
