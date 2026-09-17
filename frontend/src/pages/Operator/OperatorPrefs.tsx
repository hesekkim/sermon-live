import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  operatorCopy,
  type OperatorCopy,
  type UiLanguage,
  type UiTheme,
} from './translations';

const LANGUAGE_KEY = 'operatorUiLanguage';
const THEME_KEY = 'operatorUiTheme';

interface OperatorPrefsValue {
  language: UiLanguage;
  theme: UiTheme;
  labels: OperatorCopy;
  setLanguage: (language: UiLanguage) => void;
  setTheme: (theme: UiTheme) => void;
}

const OperatorPrefsContext = createContext<OperatorPrefsValue | null>(null);

function readLanguage(): UiLanguage {
  if (typeof window === 'undefined') {
    return 'ko';
  }
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'en' || stored === 'de' || stored === 'ko') {
    return stored;
  }
  return 'ko';
}

function readTheme(): UiTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export function OperatorPrefsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(readLanguage);
  const [theme, setThemeState] = useState<UiTheme>(readTheme);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setLanguage = useCallback((next: UiLanguage) => {
    setLanguageState(next);
  }, []);

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next);
  }, []);

  const value = useMemo(
    () => ({
      language,
      theme,
      labels: operatorCopy[language],
      setLanguage,
      setTheme,
    }),
    [language, setLanguage, setTheme, theme]
  );

  return (
    <OperatorPrefsContext.Provider value={value}>
      {children}
    </OperatorPrefsContext.Provider>
  );
}

export function useOperatorPrefs() {
  const value = useContext(OperatorPrefsContext);
  if (!value) {
    throw new Error('useOperatorPrefs must be used inside OperatorPrefsProvider');
  }
  return value;
}
