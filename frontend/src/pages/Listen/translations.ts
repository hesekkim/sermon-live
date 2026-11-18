type ListenerLanguage = 'de' | 'en' | 'ko';

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
    screenWakeLock: {
      requesting: 'Bildschirm bleibt an: Anforderung läuft.',
      active:
        'Bildschirm bleibt an, solange diese Seite sichtbar ist. Bei gesperrtem Bildschirm ist die Audiowiedergabe nicht garantiert.',
      unsupported:
        'Der Browser unterstützt das Wachhalten des Bildschirms nicht. Die automatische Bildschirmsperre wird nicht verhindert.',
      insecure:
        'Für das Wachhalten des Bildschirms ist eine vertrauenswürdige HTTPS-Verbindung erforderlich. Die automatische Bildschirmsperre wird nicht verhindert.',
      requestFailed:
        'Der Bildschirm konnte nicht wachgehalten werden. Die automatische Bildschirmsperre wird nicht verhindert.',
      released:
        'Das Betriebssystem hat die Bildschirmsperre freigegeben. Die automatische Bildschirmsperre wird nicht verhindert.',
    },
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
      ended: 'BROADCAST ENDED · GERMAN',
      interpreterReconnecting: 'TRANSLATION RECONNECTING',
      audioRecoveryRequired: 'AUDIO PLAYBACK PAUSED',
      audioOutputPending: 'WAITING FOR AUDIO',
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
      'Audio playback stopped. Tap “Resume audio” to continue listening.',
    screenWakeLock: {
      requesting: 'Keeping the screen on: request in progress.',
      active:
        'The screen stays on while this page is visible. Audio playback is not guaranteed after the screen is locked.',
      unsupported:
        'This browser does not support keeping the screen awake. Automatic screen locking is not prevented.',
      insecure:
        'A trusted HTTPS connection is required to keep the screen awake. Automatic screen locking is not prevented.',
      requestFailed:
        'The screen could not be kept awake. Automatic screen locking is not prevented.',
      released:
        'The operating system released the screen lock. Automatic screen locking is not prevented.',
    },
    dismissScripture: 'Close Bible passage',
    dismissScriptureButton: 'Close',
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
      audioRecoveryRequired: '오디오 재생 중단 · 다시 시작 필요',
      audioOutputPending: '오디오 신호 대기 중',
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
      '오디오 재생이 중단되었습니다. 오디오 다시 시작 버튼을 눌러 다시 들으세요.',
    screenWakeLock: {
      requesting: '화면 켜짐 요청 중입니다.',
      active:
        '이 페이지가 보이는 동안 화면을 켜 둡니다. 화면을 직접 잠근 뒤의 오디오 재생은 보장되지 않습니다.',
      unsupported:
        '브라우저가 화면 켜짐 기능을 지원하지 않아 자동 화면 잠금을 막을 수 없습니다.',
      insecure:
        '화면을 켜 두려면 신뢰할 수 있는 HTTPS 연결이 필요합니다. 자동 화면 잠금을 막을 수 없습니다.',
      requestFailed:
        '화면을 켜 두지 못했습니다. 자동 화면 잠금을 막을 수 없습니다.',
      released:
        '운영체제가 화면 켜짐 잠금을 해제했습니다. 자동 화면 잠금을 막을 수 없습니다.',
    },
    dismissScripture: '성경 본문 닫기',
    dismissScriptureButton: '닫기',
  },
} as const satisfies Record<ListenerLanguage, object>;

export function getListenerCopy() {
  const language = navigator.language.split('-')[0].toLowerCase();
  const supportedLanguage =
    language === 'de' || language === 'ko' ? language : 'en';
  return listenerCopy[supportedLanguage];
}
