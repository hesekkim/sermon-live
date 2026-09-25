export type UiLanguage = 'ko' | 'en' | 'de';
export type UiTheme = 'light' | 'dark';

export interface OperatorCopy {
  brand: string;
  navSettings: string;
  navBroadcast: string;
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
  audioDevicePlaceholder: string;
  audioDeviceLoadFailed: string;
  audioTest: string;
  audioTestDevice: string;
  audioTestStatus: string;
  audioTestInputLevel: string;
  audioTestDetectedFormat: string;
  audioTestProcessingFormat: string;
  audioTestRunning: string;
  audioTestNotRun: string;
  audioTestNoDevice: string;
  audioTestSignal: string;
  audioTestSilent: string;
  audioTestDisconnected: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  apiKeySaved: string;
  showApiKey: string;
  hideApiKey: string;
  apply: string;
  applySaved: string;
  applyFailed: string;
  settingsLoadFailed: string;
  darkMode: string;
  echo: string;
  openai: string;
  openaiUnavailable: string;
  echoNoKey: string;
  keyStatusValid: string;
  keyStatusMissing: string;
  keyStatusInvalid: string;
  sessionOn: string;
  sessionOff: string;
  listeners: string;
  inputLabel: string;
  outputLabel: string;
  inputDownload: string;
  outputDownload: string;
  emptyInput: string;
  emptyOutput: string;
  startFailed: string;
  stopFailed: string;
  invalidApiKey: string;
  sessionStarted: string;
  sessionStopped: string;
  sessionError: string;
  toastClose: string;
}

export const operatorCopy: Record<UiLanguage, OperatorCopy> = {
  ko: {
    brand: 'Sermon Live',
    navSettings: '설정',
    navBroadcast: '방송',
    navSermonSession: '설교 세션',
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
    audioDevicePlaceholder: '입력 장치를 선택하세요',
    audioDeviceLoadFailed: '입력 장치를 불러오지 못했습니다',
    audioTest: '오디오 테스트',
    audioTestDevice: '장치',
    audioTestStatus: '상태',
    audioTestInputLevel: '입력 레벨',
    audioTestDetectedFormat: '감지 포맷',
    audioTestProcessingFormat: 'OpenAI 처리 포맷',
    audioTestRunning: '테스트 중...',
    audioTestNotRun: '아직 테스트하지 않았습니다',
    audioTestNoDevice: '장치 미선택',
    audioTestSignal: '신호 감지',
    audioTestSilent: '무음',
    audioTestDisconnected: '연결 안 됨',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY를 입력하세요',
    apiKeySaved: '저장된 키가 있습니다',
    showApiKey: 'API KEY 표시',
    hideApiKey: 'API KEY 숨기기',
    apply: '적용',
    applySaved: '설정을 적용했습니다',
    applyFailed: '설정 적용에 실패했습니다',
    settingsLoadFailed: '설정을 불러오지 못했습니다',
    darkMode: '다크 모드',
    echo: 'Echo (로컬)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI는 아직 사용할 수 없습니다',
    echoNoKey: 'Echo는 API KEY가 필요 없습니다',
    keyStatusValid: '유효함',
    keyStatusMissing: '없음',
    keyStatusInvalid: '유효하지 않음',
    sessionOn: '방송 중지',
    sessionOff: '방송 시작',
    listeners: '참여 인원',
    inputLabel: '입력 (한국어)',
    outputLabel: '출력 (독일어)',
    inputDownload: '한국어 전사 다운로드',
    outputDownload: '독일어 번역 다운로드',
    emptyInput: '인식된 한국어가 여기에 나타납니다',
    emptyOutput: '번역된 독일어가 여기에 나타납니다',
    startFailed: '방송을 시작하지 못했습니다',
    stopFailed: '방송을 중지하지 못했습니다',
    invalidApiKey: 'API 키가 올바르지 않습니다',
    sessionStarted: '방송을 시작했습니다',
    sessionStopped: '방송을 중지했습니다',
    sessionError: '방송 처리 중 오류가 발생했습니다',
    toastClose: '닫기',
  },
  en: {
    brand: 'Sermon Live',
    navSettings: 'Settings',
    navBroadcast: 'Broadcast',
    navSermonSession: 'Sermon session',
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
    audioDevicePlaceholder: 'Select an input device',
    audioDeviceLoadFailed: 'Could not load input devices',
    audioTest: 'Audio test',
    audioTestDevice: 'Device',
    audioTestStatus: 'Status',
    audioTestInputLevel: 'Input level',
    audioTestDetectedFormat: 'Detected format',
    audioTestProcessingFormat: 'OpenAI processing format',
    audioTestRunning: 'Testing...',
    audioTestNotRun: 'Not tested yet',
    audioTestNoDevice: 'No device selected',
    audioTestSignal: 'Signal detected',
    audioTestSilent: 'Silent',
    audioTestDisconnected: 'Disconnected',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'Enter API KEY',
    apiKeySaved: 'A key is already saved',
    showApiKey: 'Show API KEY',
    hideApiKey: 'Hide API KEY',
    apply: 'Apply',
    applySaved: 'Settings applied',
    applyFailed: 'Could not apply settings',
    settingsLoadFailed: 'Could not load settings',
    darkMode: 'Dark mode',
    echo: 'Echo (local)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI is not available yet',
    echoNoKey: 'Echo does not need an API KEY',
    keyStatusValid: 'Valid',
    keyStatusMissing: 'Missing',
    keyStatusInvalid: 'Invalid',
    sessionOn: 'Stop broadcast',
    sessionOff: 'Start broadcast',
    listeners: 'Listeners',
    inputLabel: 'Input (Korean)',
    outputLabel: 'Output (German)',
    inputDownload: 'Download Korean transcript',
    outputDownload: 'Download German translation',
    emptyInput: 'Recognized Korean appears here',
    emptyOutput: 'Translated German appears here',
    startFailed: 'Could not start the broadcast',
    stopFailed: 'Could not stop the broadcast',
    invalidApiKey: 'The API key is invalid',
    sessionStarted: 'Broadcast started',
    sessionStopped: 'Broadcast stopped',
    sessionError: 'A broadcast error occurred',
    toastClose: 'Close',
  },
  de: {
    brand: 'Sermon Live',
    navSettings: 'Einstellungen',
    navBroadcast: 'Sendung',
    navSermonSession: 'Predigt-Sitzung',
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
    audioDevicePlaceholder: 'Eingabegerät auswählen',
    audioDeviceLoadFailed: 'Eingabegeräte konnten nicht geladen werden',
    audioTest: 'Audio-Test',
    audioTestDevice: 'Gerät',
    audioTestStatus: 'Status',
    audioTestInputLevel: 'Eingangspegel',
    audioTestDetectedFormat: 'Erkannte Format',
    audioTestProcessingFormat: 'OpenAI-Verarbeitungsformat',
    audioTestRunning: 'Wird getestet...',
    audioTestNotRun: 'Noch nicht getestet',
    audioTestNoDevice: 'Kein Gerät ausgewählt',
    audioTestSignal: 'Signal erkannt',
    audioTestSilent: 'Stumm',
    audioTestDisconnected: 'Getrennt',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY eingeben',
    apiKeySaved: 'Ein Schlüssel ist gespeichert',
    showApiKey: 'API KEY anzeigen',
    hideApiKey: 'API KEY ausblenden',
    apply: 'Anwenden',
    applySaved: 'Einstellungen angewendet',
    applyFailed: 'Einstellungen konnten nicht angewendet werden',
    settingsLoadFailed: 'Einstellungen konnten nicht geladen werden',
    darkMode: 'Dunkelmodus',
    echo: 'Echo (lokal)',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI ist noch nicht verfügbar',
    echoNoKey: 'Echo braucht keinen API KEY',
    keyStatusValid: 'Gültig',
    keyStatusMissing: 'Fehlt',
    keyStatusInvalid: 'Ungültig',
    sessionOn: 'Sendung stoppen',
    sessionOff: 'Sendung starten',
    listeners: 'Zuhörer',
    inputLabel: 'Eingabe (Koreanisch)',
    outputLabel: 'Ausgabe (Deutsch)',
    inputDownload: 'Koreanisches Transkript herunterladen',
    outputDownload: 'Deutsche Übersetzung herunterladen',
    emptyInput: 'Erkanntes Koreanisch erscheint hier',
    emptyOutput: 'Übersetztes Deutsch erscheint hier',
    startFailed: 'Sendung konnte nicht gestartet werden',
    stopFailed: 'Sendung konnte nicht gestoppt werden',
    invalidApiKey: 'Der API-Schlüssel ist ungültig',
    sessionStarted: 'Sendung gestartet',
    sessionStopped: 'Sendung gestoppt',
    sessionError: 'Während der Sendung ist ein Fehler aufgetreten',
    toastClose: 'Schließen',
  },
};
