export type UiLanguage = 'ko' | 'en' | 'de';
export type UiTheme = 'light' | 'dark';

export interface OperatorCopy {
  brand: string;
  navSettings: string;
  navBroadcast: string;
  collapseSidebar: string;
  expandSidebar: string;
  language: string;
  languageKo: string;
  languageEn: string;
  languageDe: string;
  interpreter: string;
  apiKey: string;
  apiKeyPlaceholder: string;
  apiKeySaved: string;
  save: string;
  saved: string;
  saveFailed: string;
  darkMode: string;
  echo: string;
  gemini: string;
  openai: string;
  openaiUnavailable: string;
  echoNoKey: string;
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
  sessionError: string;
  toastClose: string;
}

export const operatorCopy: Record<UiLanguage, OperatorCopy> = {
  ko: {
    brand: 'Sermon Live',
    navSettings: '설정',
    navBroadcast: '방송',
    collapseSidebar: '사이드바 접기',
    expandSidebar: '사이드바 펼치기',
    language: '언어',
    languageKo: '한국어',
    languageEn: '영어',
    languageDe: '독일어',
    interpreter: 'API 모델',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY를 입력하세요',
    apiKeySaved: '저장된 키가 있습니다',
    save: '저장',
    saved: '저장했습니다',
    saveFailed: '저장에 실패했습니다',
    darkMode: '다크 모드',
    echo: 'Echo (로컬)',
    gemini: 'Gemini',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI는 아직 사용할 수 없습니다',
    echoNoKey: 'Echo는 API KEY가 필요 없습니다',
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
    sessionError: '방송 처리 중 오류가 발생했습니다',
    toastClose: '닫기',
  },
  en: {
    brand: 'Sermon Live',
    navSettings: 'Settings',
    navBroadcast: 'Broadcast',
    collapseSidebar: 'Collapse sidebar',
    expandSidebar: 'Expand sidebar',
    language: 'Language',
    languageKo: 'Korean',
    languageEn: 'English',
    languageDe: 'German',
    interpreter: 'API model',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'Enter API KEY',
    apiKeySaved: 'A key is already saved',
    save: 'Save',
    saved: 'Saved',
    saveFailed: 'Could not save',
    darkMode: 'Dark mode',
    echo: 'Echo (local)',
    gemini: 'Gemini',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI is not available yet',
    echoNoKey: 'Echo does not need an API KEY',
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
    sessionError: 'A broadcast error occurred',
    toastClose: 'Close',
  },
  de: {
    brand: 'Sermon Live',
    navSettings: 'Einstellungen',
    navBroadcast: 'Sendung',
    collapseSidebar: 'Seitenleiste einklappen',
    expandSidebar: 'Seitenleiste ausklappen',
    language: 'Sprache',
    languageKo: 'Koreanisch',
    languageEn: 'Englisch',
    languageDe: 'Deutsch',
    interpreter: 'API-Modell',
    apiKey: 'API KEY',
    apiKeyPlaceholder: 'API KEY eingeben',
    apiKeySaved: 'Ein Schlüssel ist gespeichert',
    save: 'Speichern',
    saved: 'Gespeichert',
    saveFailed: 'Speichern fehlgeschlagen',
    darkMode: 'Dunkelmodus',
    echo: 'Echo (lokal)',
    gemini: 'Gemini',
    openai: 'OpenAI',
    openaiUnavailable: 'OpenAI ist noch nicht verfügbar',
    echoNoKey: 'Echo braucht keinen API KEY',
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
    sessionError: 'Während der Sendung ist ein Fehler aufgetreten',
    toastClose: 'Schließen',
  },
};
