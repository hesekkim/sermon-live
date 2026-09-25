import { useEffect, useState } from 'react';

const STORAGE_KEY = 'sermon-listener-preferences';
const DEFAULT_FONT_SIZE = 24;
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 32;

type ListenerTheme = 'light' | 'dark';

interface ListenerPreferences {
  theme: ListenerTheme;
  fontSize: number;
}

function readPreferences(): ListenerPreferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const value = JSON.parse(stored) as Partial<ListenerPreferences>;
      return {
        theme: value.theme === 'dark' ? 'dark' : 'light',
        fontSize:
          typeof value.fontSize === 'number'
            ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, value.fontSize))
            : DEFAULT_FONT_SIZE,
      };
    }
  } catch {
    return { theme: 'light', fontSize: DEFAULT_FONT_SIZE };
  }
  return { theme: 'light', fontSize: DEFAULT_FONT_SIZE };
}

export function useListenerPreferences() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      return;
    }
  }, [preferences]);

  const setTheme = (theme: ListenerTheme) => {
    setPreferences((current) => ({ ...current, theme }));
  };

  const setFontSize = (fontSize: number) => {
    setPreferences((current) => ({
      ...current,
      fontSize: Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize)),
    }));
  };

  return { ...preferences, setFontSize, setTheme };
}