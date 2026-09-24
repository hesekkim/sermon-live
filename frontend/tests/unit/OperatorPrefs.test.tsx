import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../../src/pages/Operator/settings/Settings';
import {
  OperatorPrefsProvider,
  useOperatorPrefs,
} from '../../src/pages/Operator/OperatorPrefs';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';

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
  vi.restoreAllMocks();
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

describe('Settings save flow', () => {
  it('sends the selected provider key in the PUT payload and clears the input after save', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ interpreter: 'openai', openai_key_set: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'openai',
          openai_key_set: true,
          openai_key_masked: 'abc1...c123',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const passwordInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    const showPasswordButton = container.querySelector(
      'button[aria-label="API KEY 표시"]'
    ) as HTMLButtonElement;
    expect(showPasswordButton).not.toBeNull();
    await act(async () => {
      showPasswordButton.click();
    });
    expect(container.querySelector('input[type="text"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="API KEY 숨기기"]')).not.toBeNull();

    await act(async () => {
      const visibleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(
        visibleInput,
        'abc123'
      );
      visibleInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      (container.querySelector('button[aria-label="API KEY 숨기기"]') as HTMLButtonElement).click();
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === '적용'
    );
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.click();
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/v1/operator/settings' && (init as RequestInit | undefined)?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    expect((putCall?.[1] as RequestInit | undefined)?.body).toBe(
      JSON.stringify({ interpreter: 'openai', openai_api_key: 'abc123' })
    );
    expect((container.querySelector('input[type="password"]') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('input[type="password"]') as HTMLInputElement).placeholder).toBe(
      'abc1...c123'
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows an error toast when the apply request fails with HTTP error', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ interpreter: 'openai', openai_key_set: false }),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) => ['적용', 'Apply', 'Anwenden'].includes(button.textContent?.trim() ?? '')
    );
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.click();
    });

    expect(document.body.textContent).toContain('설정 적용에 실패했습니다');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows the provider key status tag when the server reports invalid credentials', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        interpreter: 'openai',
        openai_key_set: true,
        openai_key_masked: 'abc1...c123',
        openai_key_status: 'invalid',
        openai_key_warning: '서버가 OpenAI API 키를 확인하지 못했습니다.',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain('유효하지 않음');
    expect(container.textContent).toContain('서버가 OpenAI API 키를 확인하지 못했습니다.');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows an error toast when loading settings fails', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>
      );
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('설정을 불러오지 못했습니다');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});