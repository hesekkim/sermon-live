import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  OperatorPrefsProvider,
  useOperatorPrefs,
} from '../../src/pages/Operator/OperatorPrefs';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

interface PrefState {
  language: string;
  theme: string;
  setLanguage: (language: 'ko' | 'en' | 'de') => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

function Probe({ onRender }: { onRender: (state: PrefState) => void }) {
  const { language, theme, setLanguage, setTheme } = useOperatorPrefs();
  onRender({ language, theme, setLanguage, setTheme });
  return null;
}

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  return values;
}

function renderProbe(onRender: (state: PrefState) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <OperatorPrefsProvider>
        <Probe onRender={onRender} />
      </OperatorPrefsProvider>
    );
  });
  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

beforeEach(() => {
  document.documentElement.lang = '';
  document.documentElement.dataset.theme = '';
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('OperatorPrefsProvider', () => {
  it('restores saved language and theme preferences', () => {
    installStorage({ operatorUiLanguage: 'de', operatorUiTheme: 'dark' });
    let state!: PrefState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    expect(state.language).toBe('de');
    expect(state.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('de');
    expect(document.documentElement.dataset.theme).toBe('dark');

    cleanup();
  });

  it('persists changes and synchronizes document attributes', () => {
    const values = installStorage();
    let state!: PrefState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    act(() => {
      state.setLanguage('en');
      state.setTheme('dark');
    });

    expect(values.get('operatorUiLanguage')).toBe('en');
    expect(values.get('operatorUiTheme')).toBe('dark');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset.theme).toBe('dark');

    cleanup();
  });
});