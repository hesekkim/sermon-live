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
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored === 'en' || stored === 'de' || stored === 'ko') {
      return stored;
    }
  } catch {
    return 'ko';
  }
  return 'ko';
}

function readTheme(): UiTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function OperatorPrefsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<UiLanguage>(readLanguage);
  const [theme, setThemeState] = useState<UiTheme>(readTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Ignore unavailable storage in restricted test/browser environments.
    }
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore unavailable storage in restricted test/browser environments.
    }
    document.documentElement.dataset.theme = theme;
    document.body.dataset.cmsTheme = theme;
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
