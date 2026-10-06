export type UiLanguage = 'ko' | 'en' | 'de';
export type UiTheme = 'light' | 'dark';

export interface OperatorCopy {
  brand: string;
  navSettings: string;
  navBroadcast: string;
  back: string;
  navSermonSession: string;
  sermonTitle: string;
  sermonSpeaker: string;
  sermonBibleReference: string;
  sermonBibleText: string;
  sermonNotes: string;
  sermonLifecycle: string;
  sermonPrepare: string;
  sermonReady: string;
  sermonLive: string;
  sermonEnded: string;
  sermonSave: string;
  sermonSaved: string;
  sermonSaveFailed: string;
  sermonLoadFailed: string;
  collapseSidebar: string;
  expandSidebar: string;
  language: string;
  appearance: string;
  languageKo: string;
  languageEn: string;
  languageDe: string;
  interpreter: string;
  audioDevice: string;
  audioChannel: string;
  audioChannelReselect: string;
  audioDevicePlaceholder: string;
  audioDeviceDefault: string;
  audioDeviceLoading: string;
  audioDeviceEmpty: string;
  audioDeviceSaving: string;
  audioDeviceRetry: string;
  audioDeviceRefresh: string;
  audioDeviceShowAll: string;
  audioDeviceReselect: string;
  audioDeviceSessionConflict: string;
  audioDeviceLoadFailed: string;
  audioTest: string;
  audioTestDevice: string;
  audioTestStatus: string;
  audioTestInputLevel: string;
  audioLevelStale: string;
  audioTestCaptureFormat: string;
  audioTestProcessingFormat: string;
  audioTestRunning: string;
  audioTestTimeout: string;
  audioTestStop: string;
  audioTestNotRun: string;
  audioTestNoDevice: string;
  audioTestSignal: string;
  audioTestSilent: string;
  audioTestDisconnected: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  apiKeySaved: string;
  inputTranscript: string;
  inputTranscriptDescription: string;
  showApiKey: string;
  hideApiKey: string;
  apply: string;
  saving: string;
  applySaved: string;
  applyFailed: string;
  settingsLoadFailed: string;
  darkMode: string;
  lightMode: string;
  safety: string;
  autoStopMinutes: string;
  warningMinutes: string;
  extensionMinutes: string;
  hardLimitMinutes: string;
  timerRangeHint: string;
  timerAutoStopRequired: string;
  timerWarningMustBeLess: string;
  timerExtensionRequired: string;
  timerHardLimitMinimum: string;
  echo: string;
  openai: string;
  openaiUnavailable: string;
  echoNoKey: string;
  keyStatusValid: string;
  keyStatusMissing: string;
  keyStatusInvalid: string;
  sessionOn: string;
  sessionOff: string;
  broadcastStarting: string;
  listeners: string;
  broadcastStatus: string;
  serverStatus: string;
  serverOnline: string;
  serverConnecting: string;
  serverOffline: string;
  operatorConnection: string;
  operatorConnected: string;
  operatorConnecting: string;
  operatorReconnecting: string;
  translationStatus: string;
  translationLive: string;
  translationOff: string;
  translationStarting: string;
  translationStopping: string;
  translationError: string;
  latency: string;
  latencyUnavailable: string;
  audioQueueWarning: string;
  audioQueueLoss: string;
  audioQueueLossDetails: string;
  audioStatus: string;
  audioSignal: string;
  audioSilent: string;
  audioUnavailable: string;
  inputDeviceStatus: string;
  inputDeviceReady: string;
  inputDeviceUnavailable: string;
  inputDeviceError: string;
  interpreterConnection: string;
  connectionConnected: string;
  connectionDisconnected: string;
  connectionError: string;
  remainingTime: string;
  timerStatus: string;
  timerWarning: string;
  timerHardLimit: string;
  extensionCount: string;
  timerWarningTitle: string;
  timerWarningBody: string;
  extendSession: string;
  extendFailed: string;
  stopNow: string;
  lastTerminationReason: string;
  terminationManual: string;
  terminationAutoStop: string;
  terminationHardLimit: string;
  terminationInterpreterError: string;
  terminationDeviceError: string;
  terminationServerShutdown: string;
  terminationUnknown: string;
  inputLabel: string;
  outputLabel: string;
  inputDownload: string;
  outputDownload: string;
  startWithTranscriptTitle: string;
  startWithTranscriptBody: string;
  downloadAndStart: string;
  discardAndStart: string;
  cancelStart: string;
  emptyInput: string;
  emptyOutput: string;
  startFailed: string;
  stopFailed: string;
  invalidApiKey: string;
  sessionStarted: string;
  sessionStopped: string;
  sessionError: string;
  sessionErrorLabel: string;
  toastClose: string;
  operatorAuthTitle: string;
  operatorAuthPassword: string;
  operatorAuthSubmit: string;
  operatorAuthChecking: string;
  operatorAuthUnavailable: string;
  operatorAuthInvalid: string;
  operatorAuthRetry: string;
  operatorAuthLogout: string;
  operatorAuthLogoutFailed: string;
  listenQrOpen: string;
  listenQrTitle: string;
  listenQrLoading: string;
  listenQrUnavailable: string;
  listenQrAddress: string;
  listenQrCopy: string;
  listenQrCopied: string;
  listenQrCopyFailed: string;
  listenQrRefresh: string;
}

export const operatorCopy: Record<UiLanguage, OperatorCopy> = {
  ko: {
    brand: 'Sermon Live',
    navSettings: '설정',
    navBroadcast: '방송',
    back: '뒤로 가기',
    navSermonSession: '설교',
    sermonTitle: '설교 제목',
    sermonSpeaker: '설교자',
    sermonBibleReference: '성경 본문',
    sermonBibleText: '본문 내용',
    sermonNotes: '노트',
    sermonLifecycle: '진행 상태',
    sermonPrepare: '준비',
    sermonReady: '준비 완료',
    sermonLive: '방송 중',
    sermonEnded: '종료',
    sermonSave: '설교 정보 저장',
    sermonSaved: '설교 정보를 저장했습니다',
    sermonSaveFailed: '설교 정보를 저장하지 못했습니다',
    sermonLoadFailed: '설교 정보를 불러오지 못했습니다',
    collapseSidebar: '사이드바 접기',
    expandSidebar: '사이드바 펼치기',
    language: '언어',
    appearance: '화면',
    languageKo: '한국어',
    languageEn: '영어',
    languageDe: '독일어',
    interpreter: 'API 모델',
    audioDevice: '입력 장치',
    audioChannel: '입력 채널',
    audioChannelReselect: '저장된 입력 채널을 사용할 수 없습니다. 다시 선택하세요.',
    audioDevicePlaceholder: '입력 장치를 선택하세요',
    audioDeviceDefault: '시스템 기본 장치',
    audioDeviceLoading: '입력 장치를 불러오는 중입니다',
    audioDeviceEmpty:
      '사용 가능한 입력 장치가 없습니다. 시스템 기본 장치를 사용할 수 있습니다.',
    audioDeviceSaving: '입력 장치를 저장하는 중입니다',
    audioDeviceRetry: '다시 시도',
    audioDeviceRefresh: '장치 새로고침',
    audioDeviceShowAll: '모든 오디오 경로 표시',
    audioDeviceReselect: '저장된 입력 장치를 찾을 수 없습니다. 다시 선택하세요.',
    audioDeviceSessionConflict:
      '통역 세션을 중지한 뒤 입력 장치를 바꾸거나 테스트하세요.',
    audioDeviceLoadFailed: '입력 장치를 불러오지 못했습니다',
    audioTest: '오디오 테스트',
    audioTestDevice: '장치',
    audioTestStatus: '상태',
    audioTestInputLevel: '입력 레벨',
    audioLevelStale: '오래된 측정값',
    audioTestCaptureFormat: '캡처 스트림 포맷',
    audioTestProcessingFormat: '처리 포맷',
    audioTestRunning: '테스트 중...',
    audioTestTimeout:
      '오디오 테스트가 시간 내에 완료되지 않았습니다. 입력 장치 연결을 확인한 뒤 다시 시도하세요.',
    audioTestStop: '테스트 중지',
    audioTestNotRun: '아직 테스트하지 않았습니다',
    audioTestNoDevice: '장치 미선택',
    audioTestSignal: '신호 감지',
    audioTestSilent: '무음',
    audioTestDisconnected: '연결 안 됨',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY를 입력하세요',
    apiKeySaved: '저장된 키가 있습니다',
    inputTranscript: '한국어 원문 transcript 사용',
    inputTranscriptDescription:
      '한국어 원문 transcript는 현재 비활성화되어 있으며 통역 서비스로 전송되지 않습니다.',
    showApiKey: 'API KEY 표시',
    hideApiKey: 'API KEY 숨기기',
    apply: '적용',
    saving: '저장 중...',
    applySaved: '설정을 적용했습니다',
    applyFailed: '설정 적용에 실패했습니다',
    settingsLoadFailed: '설정을 불러오지 못했습니다',
    darkMode: '다크 모드',
    lightMode: '라이트 모드',
    safety: '안전 설정',
    autoStopMinutes: '자동 종료 (분)',
    warningMinutes: '경고 (분)',
    extensionMinutes: '연장 (분)',
    hardLimitMinutes: '하드 제한 (분)',
    timerRangeHint:
      '경고 시간은 자동 종료보다 작아야 하며, 하드 제한은 자동 종료 이상이어야 합니다.',
    timerAutoStopRequired: '자동 종료 시간은 1분 이상의 정수여야 합니다.',
    timerWarningMustBeLess:
      '경고 시간은 1분 이상의 정수이며 자동 종료 시간보다 작아야 합니다.',
    timerExtensionRequired: '연장 시간은 1분 이상의 정수여야 합니다.',
    timerHardLimitMinimum:
      '하드 제한 시간은 자동 종료 시간 이상의 정수여야 합니다.',
    echo: 'Echo (로컬)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI는 아직 사용할 수 없습니다',
    echoNoKey: 'Echo는 API KEY가 필요 없습니다',
    keyStatusValid: '유효함',
    keyStatusMissing: '없음',
    keyStatusInvalid: '유효하지 않음',
    sessionOn: '방송 중지',
    sessionOff: '방송 시작',
    broadcastStarting: '방송 시작 중...',
    listeners: '참여 인원',
    broadcastStatus: '방송 운영 상태',
    serverStatus: '서버',
    serverOnline: '온라인',
    serverConnecting: '연결 중',
    serverOffline: '오프라인',
    operatorConnection: '운영 연결',
    operatorConnected: '연결됨',
    operatorConnecting: '연결 중',
    operatorReconnecting: '재연결 중',
    translationStatus: '통역 세션',
    translationLive: 'LIVE',
    translationOff: 'OFF',
    translationStarting: '시작 중',
    translationStopping: '종료 중',
    translationError: '오류',
    latency: '청크 → 자막 지연',
    latencyUnavailable: '측정 대기',
    audioQueueWarning: '전송 지연으로 오디오 일부를 건너뛰었습니다',
    audioQueueLoss: '누적 손실:',
    audioQueueLossDetails: '{chunks}개 청크, {seconds}초',
    audioStatus: '오디오 신호',
    audioSignal: '신호 감지',
    audioSilent: '무음',
    audioUnavailable: '세션 꺼짐',
    inputDeviceStatus: '입력 장치',
    inputDeviceReady: '연결됨',
    inputDeviceUnavailable: '사용할 수 없음',
    inputDeviceError: '오류',
    interpreterConnection: '통역 연결',
    connectionConnected: '연결됨',
    connectionDisconnected: '연결 안 됨',
    connectionError: '오류',
    remainingTime: '남은 시간',
    timerStatus: '타이머 상태',
    timerWarning: '종료 임박 경고',
    timerHardLimit: '최대 시간 도달',
    extensionCount: '연장 횟수',
    timerWarningTitle: '세션 종료 임박',
    timerWarningBody:
      '남은 시간이 {remainingMinutes}분 남았습니다. {extensionMinutes}분 연장하거나 지금 종료할 수 있습니다.',
    extendSession: '연장',
    extendFailed: '세션을 연장하지 못했습니다',
    stopNow: '지금 종료',
    lastTerminationReason: '마지막 종료 사유',
    terminationManual: '수동 종료',
    terminationAutoStop: '자동 종료',
    terminationHardLimit: '최대 시간 도달',
    terminationInterpreterError: '통역 오류로 종료',
    terminationDeviceError: '입력 장치 오류로 종료',
    terminationServerShutdown: '서버 종료로 중단',
    terminationUnknown: '세션 종료',
    inputLabel: '입력 (한국어)',
    outputLabel: '출력 (독일어)',
    inputDownload: '한국어 전사 다운로드',
    outputDownload: '독일어 번역 다운로드',
    startWithTranscriptTitle: '이전 방송 기록',
    startWithTranscriptBody:
      '이전 Output을 다운로드할까요? 새 방송을 시작하면 Input과 Output 기록이 삭제됩니다.',
    downloadAndStart: '다운로드 후 시작',
    discardAndStart: '다운로드하지 않고 시작',
    cancelStart: '취소',
    emptyInput: '인식된 한국어가 여기에 나타납니다',
    emptyOutput: '번역된 독일어가 여기에 나타납니다',
    startFailed: '방송을 시작하지 못했습니다',
    stopFailed: '방송을 중지하지 못했습니다',
    invalidApiKey: 'API 키가 올바르지 않습니다',
    sessionStarted: '방송을 시작했습니다',
    sessionStopped: '방송을 중지했습니다',
    sessionError: '방송 처리 중 오류가 발생했습니다',
    sessionErrorLabel: '세션 오류',
    toastClose: '닫기',
    operatorAuthTitle: 'Operator 로그인',
    operatorAuthPassword: '비밀번호',
    operatorAuthSubmit: '로그인',
    operatorAuthChecking: '인증 상태를 확인하고 있습니다',
    operatorAuthUnavailable:
      '인증 서버에 연결할 수 없습니다. 설정과 서버 상태를 확인하세요.',
    operatorAuthInvalid: '비밀번호가 올바르지 않습니다',
    operatorAuthRetry: '다시 시도',
    operatorAuthLogout: '로그아웃',
    operatorAuthLogoutFailed:
      '로그아웃에 실패했습니다. 연결을 확인하고 다시 시도하세요.',
    listenQrOpen: '청취 QR',
    listenQrTitle: '청취 페이지 QR',
    listenQrLoading: '접속 주소를 확인하는 중입니다',
    listenQrUnavailable:
      '접속 가능한 LAN 주소를 확인하지 못했습니다. 네트워크를 확인하고 다시 시도하세요.',
    listenQrAddress: '청취 주소',
    listenQrCopy: '주소 복사',
    listenQrCopied: '주소를 복사했습니다',
    listenQrCopyFailed: '주소를 복사하지 못했습니다',
    listenQrRefresh: '다시 확인',
  },
  en: {
    brand: 'Sermon Live',
    navSettings: 'Settings',
    navBroadcast: 'Broadcast',
    back: 'Back',
    navSermonSession: 'Sermon',
    sermonTitle: 'Sermon title',
    sermonSpeaker: 'Speaker',
    sermonBibleReference: 'Bible reference',
    sermonBibleText: 'Bible text',
    sermonNotes: 'Notes',
    sermonLifecycle: 'Lifecycle',
    sermonPrepare: 'Prepare',
    sermonReady: 'Ready',
    sermonLive: 'Live',
    sermonEnded: 'Ended',
    sermonSave: 'Save sermon details',
    sermonSaved: 'Sermon details saved',
    sermonSaveFailed: 'Could not save sermon details',
    sermonLoadFailed: 'Could not load sermon details',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    language: 'Language',
    appearance: 'Appearance',
    languageKo: 'Korean',
    languageEn: 'English',
    languageDe: 'German',
    interpreter: 'API model',
    audioDevice: 'Input device',
    audioChannel: 'Input channel',
    audioChannelReselect: 'The saved input channel is unavailable. Select another channel.',
    audioDevicePlaceholder: 'Select an input device',
    audioDeviceDefault: 'System default',
    audioDeviceLoading: 'Loading input devices',
    audioDeviceEmpty:
      'No input devices are available. The system default may still be used.',
    audioDeviceSaving: 'Saving input device',
    audioDeviceRetry: 'Retry',
    audioDeviceRefresh: 'Refresh devices',
    audioDeviceShowAll: 'Show all audio paths',
    audioDeviceReselect: 'The saved input device was not found. Select it again.',
    audioDeviceSessionConflict:
      'Stop the translation session before changing or testing the input device.',
    audioDeviceLoadFailed: 'Could not load input devices',
    audioTest: 'Audio test',
    audioTestDevice: 'Device',
    audioTestStatus: 'Status',
    audioTestInputLevel: 'Input level',
    audioLevelStale: 'Stale measurement',
    audioTestCaptureFormat: 'Capture stream format',
    audioTestProcessingFormat: 'Processing format',
    audioTestRunning: 'Testing...',
    audioTestTimeout:
      'The audio test did not finish in time. Check the input device connection and try again.',
    audioTestStop: 'Stop test',
    audioTestNotRun: 'Not tested yet',
    audioTestNoDevice: 'No device selected',
    audioTestSignal: 'Signal detected',
    audioTestSilent: 'Silent',
    audioTestDisconnected: 'Disconnected',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'Enter API KEY',
    apiKeySaved: 'A key is already saved',
    inputTranscript: 'Enable Korean source transcript',
    inputTranscriptDescription:
      'Korean source transcripts are currently disabled and are not sent to the translation provider.',
    showApiKey: 'Show API KEY',
    hideApiKey: 'Hide API KEY',
    apply: 'Apply',
    saving: 'Saving...',
    applySaved: 'Settings applied',
    applyFailed: 'Could not apply settings',
    settingsLoadFailed: 'Could not load settings',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    safety: 'Safety settings',
    autoStopMinutes: 'Auto stop (minutes)',
    warningMinutes: 'Warning (minutes)',
    extensionMinutes: 'Extension (minutes)',
    hardLimitMinutes: 'Hard limit (minutes)',
    timerRangeHint:
      'The warning must be shorter than auto stop, and the hard limit must be at or above auto stop.',
    timerAutoStopRequired:
      'Auto stop must be a whole number of at least 1 minute.',
    timerWarningMustBeLess:
      'Warning must be a positive whole number shorter than auto stop.',
    timerExtensionRequired:
      'Extension must be a whole number of at least 1 minute.',
    timerHardLimitMinimum:
      'Hard limit must be a whole number at least the auto-stop time.',
    echo: 'Echo (local)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI is not available yet',
    echoNoKey: 'Echo does not need an API KEY',
    keyStatusValid: 'Valid',
    keyStatusMissing: 'Missing',
    keyStatusInvalid: 'Invalid',
    sessionOn: 'Stop broadcast',
    sessionOff: 'Start broadcast',
    broadcastStarting: 'Starting broadcast...',
    listeners: 'Listeners',
    broadcastStatus: 'Broadcast status',
    serverStatus: 'Server',
    serverOnline: 'Online',
    serverConnecting: 'Connecting',
    serverOffline: 'Offline',
    operatorConnection: 'Operator connection',
    operatorConnected: 'Connected',
    operatorConnecting: 'Connecting',
    operatorReconnecting: 'Reconnecting',
    translationStatus: 'Translation session',
    translationLive: 'LIVE',
    translationOff: 'OFF',
    translationStarting: 'Starting',
    translationStopping: 'Stopping',
    translationError: 'Error',
    latency: 'Chunk to caption',
    latencyUnavailable: 'Waiting for data',
    audioQueueWarning: 'Audio was skipped because translation fell behind',
    audioQueueLoss: 'Cumulative loss:',
    audioQueueLossDetails: '{chunks} chunks, {seconds}s',
    audioStatus: 'Audio signal',
    audioSignal: 'Signal detected',
    audioSilent: 'Silent',
    audioUnavailable: 'Session off',
    inputDeviceStatus: 'Input device',
    inputDeviceReady: 'Ready',
    inputDeviceUnavailable: 'Unavailable',
    inputDeviceError: 'Error',
    interpreterConnection: 'Interpreter connection',
    connectionConnected: 'Connected',
    connectionDisconnected: 'Disconnected',
    connectionError: 'Error',
    remainingTime: 'Remaining',
    timerStatus: 'Timer status',
    timerWarning: 'Ending soon',
    timerHardLimit: 'Hard limit reached',
    extensionCount: 'Extensions',
    timerWarningTitle: 'Session ending soon',
    timerWarningBody:
      'You have {remainingMinutes} minutes remaining. You can extend by {extensionMinutes} minutes or stop now.',
    extendSession: 'Extend',
    extendFailed: 'Could not extend the session',
    stopNow: 'Stop now',
    lastTerminationReason: 'Last termination reason',
    terminationManual: 'Stopped manually',
    terminationAutoStop: 'Automatically stopped',
    terminationHardLimit: 'Hard limit reached',
    terminationInterpreterError: 'Stopped due to an interpreter error',
    terminationDeviceError: 'Stopped due to a device error',
    terminationServerShutdown: 'Stopped by server shutdown',
    terminationUnknown: 'Session ended',
    inputLabel: 'Input (Korean)',
    outputLabel: 'Output (German)',
    inputDownload: 'Download Korean transcript',
    outputDownload: 'Download German translation',
    startWithTranscriptTitle: 'Previous broadcast transcript',
    startWithTranscriptBody:
      'Download the previous output? Starting a new broadcast clears both input and output transcripts.',
    downloadAndStart: 'Download and start',
    discardAndStart: 'Start without downloading',
    cancelStart: 'Cancel',
    emptyInput: 'Recognized Korean appears here',
    emptyOutput: 'Translated German appears here',
    startFailed: 'Could not start the broadcast',
    stopFailed: 'Could not stop the broadcast',
    invalidApiKey: 'The API key is invalid',
    sessionStarted: 'Broadcast started',
    sessionStopped: 'Broadcast stopped',
    sessionError: 'A broadcast error occurred',
    sessionErrorLabel: 'Session error',
    toastClose: 'Close',
    operatorAuthTitle: 'Operator sign in',
    operatorAuthPassword: 'Password',
    operatorAuthSubmit: 'Sign in',
    operatorAuthChecking: 'Checking authentication',
    operatorAuthUnavailable:
      'Authentication is unavailable. Check the server and its configuration.',
    operatorAuthInvalid: 'The password is incorrect',
    operatorAuthRetry: 'Retry',
    operatorAuthLogout: 'Sign out',
    operatorAuthLogoutFailed:
      'Sign out failed. Check your connection and try again.',
    listenQrOpen: 'Listener QR',
    listenQrTitle: 'Listener page QR',
    listenQrLoading: 'Checking the listener address',
    listenQrUnavailable:
      'A reachable LAN address could not be found. Check the network and try again.',
    listenQrAddress: 'Listener address',
    listenQrCopy: 'Copy address',
    listenQrCopied: 'Address copied',
    listenQrCopyFailed: 'Could not copy the address',
    listenQrRefresh: 'Check again',
  },
  de: {
    brand: 'Sermon Live',
    navSettings: 'Einstellungen',
    navBroadcast: 'Sendung',
    back: 'Zurück',
    navSermonSession: 'Predigt',
    sermonTitle: 'Predigttitel',
    sermonSpeaker: 'Prediger',
    sermonBibleReference: 'Bibelstelle',
    sermonBibleText: 'Bibeltext',
    sermonNotes: 'Notizen',
    sermonLifecycle: 'Status',
    sermonPrepare: 'Vorbereitung',
    sermonReady: 'Bereit',
    sermonLive: 'Live',
    sermonEnded: 'Beendet',
    sermonSave: 'Predigtdaten speichern',
    sermonSaved: 'Predigtdaten gespeichert',
    sermonSaveFailed: 'Predigtdaten konnten nicht gespeichert werden',
    sermonLoadFailed: 'Predigtdaten konnten nicht geladen werden',
    collapseSidebar: 'Seitenleiste einklappen',
    expandSidebar: 'Seitenleiste ausklappen',
    language: 'Sprache',
    appearance: 'Darstellung',
    languageKo: 'Koreanisch',
    languageEn: 'Englisch',
    languageDe: 'Deutsch',
    interpreter: 'API-Modell',
    audioDevice: 'Eingabegerät',
    audioChannel: 'Eingangskanal',
    audioChannelReselect: 'Der gespeicherte Eingangskanal ist nicht verfügbar. Bitte wählen Sie einen anderen Kanal.',
    audioDevicePlaceholder: 'Eingabegerät auswählen',
    audioDeviceDefault: 'Systemstandard',
    audioDeviceLoading: 'Eingabegeräte werden geladen',
    audioDeviceEmpty:
      'Keine Eingabegeräte verfügbar. Der Systemstandard kann weiterhin verwendet werden.',
    audioDeviceSaving: 'Eingabegerät wird gespeichert',
    audioDeviceRetry: 'Erneut versuchen',
    audioDeviceRefresh: 'Geräte aktualisieren',
    audioDeviceShowAll: 'Alle Audiopfade anzeigen',
    audioDeviceReselect: 'Das gespeicherte Eingabegerät wurde nicht gefunden. Bitte erneut auswählen.',
    audioDeviceSessionConflict:
      'Beenden Sie die Übersetzungssitzung, bevor Sie das Eingabegerät ändern oder testen.',
    audioDeviceLoadFailed: 'Eingabegeräte konnten nicht geladen werden',
    audioTest: 'Audio-Test',
    audioTestDevice: 'Gerät',
    audioTestStatus: 'Status',
    audioTestInputLevel: 'Eingangspegel',
    audioLevelStale: 'Veralteter Messwert',
    audioTestCaptureFormat: 'Aufnahme-Streamformat',
    audioTestProcessingFormat: 'Verarbeitungsformat',
    audioTestRunning: 'Wird getestet...',
    audioTestTimeout:
      'Der Audiotest wurde nicht rechtzeitig abgeschlossen. Prüfen Sie die Verbindung des Eingabegeräts und versuchen Sie es erneut.',
    audioTestStop: 'Test stoppen',
    audioTestNotRun: 'Noch nicht getestet',
    audioTestNoDevice: 'Kein Gerät ausgewählt',
    audioTestSignal: 'Signal erkannt',
    audioTestSilent: 'Stumm',
    audioTestDisconnected: 'Getrennt',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY eingeben',
    apiKeySaved: 'Ein Schlüssel ist gespeichert',
    inputTranscript: 'Koreanisches Originaltranskript verwenden',
    inputTranscriptDescription:
      'Koreanische Originaltranskripte sind derzeit deaktiviert und werden nicht an den Übersetzungsdienst gesendet.',
    showApiKey: 'API KEY anzeigen',
    hideApiKey: 'API KEY ausblenden',
    apply: 'Anwenden',
    saving: 'Wird gespeichert...',
    applySaved: 'Einstellungen angewendet',
    applyFailed: 'Einstellungen konnten nicht angewendet werden',
    settingsLoadFailed: 'Einstellungen konnten nicht geladen werden',
    darkMode: 'Dunkelmodus',
    lightMode: 'Heller Modus',
    safety: 'Sicherheitsoptionen',
    autoStopMinutes: 'Automatisches Stoppen (Minuten)',
    warningMinutes: 'Warnung (Minuten)',
    extensionMinutes: 'Verlängerung (Minuten)',
    hardLimitMinutes: 'Hartes Limit (Minuten)',
    timerRangeHint:
      'Die Warnung muss kürzer als das automatische Stoppen sein und das harte Limit muss mindestens so groß wie das automatische Stoppen sein.',
    timerAutoStopRequired:
      'Die automatische Stoppzeit muss eine ganze Zahl von mindestens 1 Minute sein.',
    timerWarningMustBeLess:
      'Die Warnzeit muss eine positive ganze Zahl und kürzer als die automatische Stoppzeit sein.',
    timerExtensionRequired:
      'Die Verlängerung muss eine ganze Zahl von mindestens 1 Minute sein.',
    timerHardLimitMinimum:
      'Das harte Limit muss eine ganze Zahl und mindestens so groß wie die automatische Stoppzeit sein.',
    echo: 'Echo (lokal)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI ist noch nicht verfügbar',
    echoNoKey: 'Echo braucht keinen API KEY',
    keyStatusValid: 'Gültig',
    keyStatusMissing: 'Fehlt',
    keyStatusInvalid: 'Ungültig',
    sessionOn: 'Sendung stoppen',
    sessionOff: 'Sendung starten',
    broadcastStarting: 'Sendung wird gestartet...',
    listeners: 'Zuhörer',
    broadcastStatus: 'Sendungsstatus',
    serverStatus: 'Server',
    serverOnline: 'Online',
    serverConnecting: 'Verbindung wird hergestellt',
    serverOffline: 'Offline',
    operatorConnection: 'Operator-Verbindung',
    operatorConnected: 'Verbunden',
    operatorConnecting: 'Verbindung wird hergestellt',
    operatorReconnecting: 'Verbindung wird wiederhergestellt',
    translationStatus: 'Übersetzungssitzung',
    translationLive: 'LIVE',
    translationOff: 'AUS',
    translationStarting: 'Startet',
    translationStopping: 'Wird beendet',
    translationError: 'Fehler',
    latency: 'Chunk bis Untertitel',
    latencyUnavailable: 'Warte auf Daten',
    audioQueueWarning:
      'Audio wurde wegen eines Übersetzungsrückstands übersprungen',
    audioQueueLoss: 'Kumulativer Verlust:',
    audioQueueLossDetails: '{chunks} Audioblöcke, {seconds}s',
    audioStatus: 'Audiosignal',
    audioSignal: 'Signal erkannt',
    audioSilent: 'Stumm',
    audioUnavailable: 'Sitzung aus',
    inputDeviceStatus: 'Eingabegerät',
    inputDeviceReady: 'Verbunden',
    inputDeviceUnavailable: 'Nicht verfügbar',
    inputDeviceError: 'Fehler',
    interpreterConnection: 'Dolmetschverbindung',
    connectionConnected: 'Verbunden',
    connectionDisconnected: 'Getrennt',
    connectionError: 'Fehler',
    remainingTime: 'Verbleibend',
    timerStatus: 'Timerstatus',
    timerWarning: 'Ende steht bevor',
    timerHardLimit: 'Maximale Dauer erreicht',
    extensionCount: 'Verlängerungen',
    timerWarningTitle: 'Sitzung endet bald',
    timerWarningBody:
      'Es bleiben noch {remainingMinutes} Minuten. Sie können um {extensionMinutes} Minuten verlängern oder sofort beenden.',
    extendSession: 'Verlängern',
    extendFailed: 'Die Sitzung konnte nicht verlängert werden',
    stopNow: 'Jetzt beenden',
    lastTerminationReason: 'Letzter Beendigungsgrund',
    terminationManual: 'Manuell beendet',
    terminationAutoStop: 'Automatisch beendet',
    terminationHardLimit: 'Maximale Dauer erreicht',
    terminationInterpreterError: 'Wegen Dolmetschfehler beendet',
    terminationDeviceError: 'Wegen Gerätefehler beendet',
    terminationServerShutdown: 'Wegen Serverabschaltung beendet',
    terminationUnknown: 'Sitzung beendet',
    inputLabel: 'Eingabe (Koreanisch)',
    outputLabel: 'Ausgabe (Deutsch)',
    inputDownload: 'Koreanisches Transkript herunterladen',
    outputDownload: 'Deutsche Übersetzung herunterladen',
    startWithTranscriptTitle: 'Transkript der vorherigen Sendung',
    startWithTranscriptBody:
      'Vorherige Ausgabe herunterladen? Beim Start einer neuen Sendung werden Eingabe und Ausgabe gelöscht.',
    downloadAndStart: 'Herunterladen und starten',
    discardAndStart: 'Ohne Download starten',
    cancelStart: 'Abbrechen',
    emptyInput: 'Erkanntes Koreanisch erscheint hier',
    emptyOutput: 'Übersetztes Deutsch erscheint hier',
    startFailed: 'Sendung konnte nicht gestartet werden',
    stopFailed: 'Sendung konnte nicht gestoppt werden',
    invalidApiKey: 'Der API-Schlüssel ist ungültig',
    sessionStarted: 'Sendung gestartet',
    sessionStopped: 'Sendung gestoppt',
    sessionError: 'Während der Sendung ist ein Fehler aufgetreten',
    sessionErrorLabel: 'Sitzungsfehler',
    toastClose: 'Schließen',
    operatorAuthTitle: 'Operator-Anmeldung',
    operatorAuthPassword: 'Passwort',
    operatorAuthSubmit: 'Anmelden',
    operatorAuthChecking: 'Authentifizierung wird geprüft',
    operatorAuthUnavailable:
      'Authentifizierung nicht verfügbar. Server und Konfiguration prüfen.',
    operatorAuthInvalid: 'Das Passwort ist falsch',
    operatorAuthRetry: 'Erneut versuchen',
    operatorAuthLogout: 'Abmelden',
    operatorAuthLogoutFailed:
      'Abmelden fehlgeschlagen. Verbindung prüfen und erneut versuchen.',
    listenQrOpen: 'QR für Zuhörer',
    listenQrTitle: 'QR für die Hörerseite',
    listenQrLoading: 'Höreradresse wird geprüft',
    listenQrUnavailable:
      'Es wurde keine erreichbare LAN-Adresse gefunden. Netzwerk prüfen und erneut versuchen.',
    listenQrAddress: 'Höreradresse',
    listenQrCopy: 'Adresse kopieren',
    listenQrCopied: 'Adresse kopiert',
    listenQrCopyFailed: 'Adresse konnte nicht kopiert werden',
    listenQrRefresh: 'Erneut prüfen',
  },
};
