import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '../../src/pages/Operator/settings/Settings';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});
import {
  OperatorPrefsProvider,
  useOperatorPrefs,
} from '../../src/pages/Operator/OperatorPrefs';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

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
      </OperatorPrefsProvider>,
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
        json: async () => [
          {
            index: 0,
            name: 'Built-in microphone',
            input_channels: 1,
            default_sample_rate: 44100,
          },
          {
            index: 1,
            name: 'USB Audio',
            input_channels: 2,
            default_sample_rate: 48000,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'openai',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) =>
        button.textContent?.includes('API Model') ||
        button.textContent?.includes('API 모델'),
    );
    await act(async () => {
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const interpreterButton = Array.from(
      container.querySelectorAll('button[aria-haspopup="listbox"]'),
    )[0] as HTMLButtonElement;
    await act(async () => {
      interpreterButton.click();
    });
    const openAiOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find((option) => option.getAttribute('aria-label') === 'OpenAI') as
      | HTMLButtonElement
      | undefined;
    expect(openAiOption).not.toBeUndefined();
    await act(async () => {
      openAiOption?.click();
    });

    const passwordInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    expect(passwordInput).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(passwordInput, 'abc123');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
    );
    expect(saveButton).not.toBeNull();
    await act(async () => {
      saveButton?.click();
    });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/v1/operator/settings' &&
        (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    expect(
      JSON.parse((putCall?.[1] as RequestInit | undefined)?.body as string),
    ).toMatchObject({
      interpreter: 'openai',
      openai_api_key: 'abc123',
    });

    const clearedInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    expect(clearedInput.value).toBe('');
    expect(clearedInput.placeholder).toBe('abc1...c123');

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
        json: async () => [
          {
            index: 0,
            name: 'Built-in microphone',
            input_channels: 1,
            default_sample_rate: 44100,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: false,
        }),
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) =>
        button.textContent?.includes('API Model') ||
        button.textContent?.includes('API 모델'),
    );
    await act(async () => {
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const interpreterButton = container.querySelector(
      'button[aria-haspopup="listbox"]',
    ) as HTMLButtonElement;
    await act(async () => {
      interpreterButton.click();
    });
    const openAiOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find((option) => option.getAttribute('aria-label') === 'OpenAI') as
      | HTMLButtonElement
      | undefined;
    await act(async () => {
      openAiOption?.click();
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            index: 0,
            name: 'Built-in microphone',
            input_channels: 1,
            default_sample_rate: 44100,
          },
        ],
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          interpreter: 'openai',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) =>
        button.textContent?.includes('API Model') ||
        button.textContent?.includes('API 모델'),
    );
    await act(async () => {
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('유효하지 않음');
    expect(container.textContent).toContain(
      '서버가 OpenAI API 키를 확인하지 못했습니다.',
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('saves translation timer settings and validates their constraints', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            index: 0,
            name: 'Built-in microphone',
            input_channels: 1,
            default_sample_rate: 44100,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 45,
          translation_session_warning_minutes: 3,
          translation_session_extension_minutes: 15,
          translation_session_hard_limit_minutes: 90,
          openai_key_set: false,
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const safetyTab = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ).find(
      (button) =>
        button.textContent?.includes('안전 설정') ||
        button.textContent?.includes('Safety'),
    );
    await act(async () => {
      safetyTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
    ) as HTMLButtonElement;
    expect(saveButton).toBeDisabled();

    const autoStopInput = container.querySelector(
      'input[name="translation_session_auto_stop_minutes"]',
    ) as HTMLInputElement;
    const warningInput = container.querySelector(
      'input[name="translation_session_warning_minutes"]',
    ) as HTMLInputElement;
    const extensionInput = container.querySelector(
      'input[name="translation_session_extension_minutes"]',
    ) as HTMLInputElement;
    const hardLimitInput = container.querySelector(
      'input[name="translation_session_hard_limit_minutes"]',
    ) as HTMLInputElement;

    expect(autoStopInput).not.toBeNull();
    expect(warningInput).not.toBeNull();
    expect(extensionInput).not.toBeNull();
    expect(hardLimitInput).not.toBeNull();

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '45');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(saveButton).toBeEnabled();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '90');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(saveButton).toBeDisabled();

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '45.5');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(warningInput, '3');
      warningInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(extensionInput, '15');
      extensionInput.dispatchEvent(new Event('input', { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(hardLimitInput, '90');
      hardLimitInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(saveButton).toBeDisabled();

    await act(async () => {
      saveButton?.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(saveButton).toBeDisabled();
    expect(container.textContent).toContain(
      '자동 종료 시간은 1분 이상의 정수여야 합니다.',
    );

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '45');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(saveButton).toBeEnabled();
    await act(async () => saveButton?.click());

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/v1/operator/settings' &&
        (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    expect((putCall?.[1] as RequestInit | undefined)?.body).toContain(
      '"translation_session_auto_stop_minutes":45',
    );
    expect((putCall?.[1] as RequestInit | undefined)?.body).toContain(
      '"translation_session_warning_minutes":3',
    );
    expect((putCall?.[1] as RequestInit | undefined)?.body).toContain(
      '"translation_session_extension_minutes":15',
    );
    expect((putCall?.[1] as RequestInit | undefined)?.body).toContain(
      '"translation_session_hard_limit_minutes":90',
    );
    expect(saveButton).toBeDisabled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('returns API Model Apply to pristine when a temporary key is cleared', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: false,
        }),
      }),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (tab) =>
        tab.textContent?.includes('API 모델') ||
        tab.textContent?.includes('API Model'),
    );
    await act(async () =>
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
    ) as HTMLButtonElement;
    const keyInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    expect(applyButton).toBeDisabled();

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(keyInput, 'temporary-key');
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(applyButton).toBeEnabled();

    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(keyInput, '');
      keyInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(applyButton).toBeDisabled();

    await act(async () => root.unmount());
    container.remove();
  });

  it('renders tabs, keeps only the active panel visible, and returns to broadcast', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        interpreter: 'echo',
        audio_device: '0',
        translation_session_auto_stop_minutes: 90,
        translation_session_warning_minutes: 5,
        translation_session_extension_minutes: 10,
        translation_session_hard_limit_minutes: 120,
        openai_key_set: false,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    mockNavigate.mockClear();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
    });

    const appearanceTab = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    expect(appearanceTab).not.toBeNull();
    expect(appearanceTab?.textContent).toContain('화면');
    expect(container.textContent).toContain('언어');

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) =>
        button.textContent?.includes('API Model') ||
        button.textContent?.includes('API 모델'),
    );
    expect(apiTab).not.toBeNull();

    await act(async () => {
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('API KEY');

    const backButton = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        button.textContent?.includes('Back') ||
        button.textContent?.includes('뒤로'),
    );
    expect(backButton).not.toBeNull();
    await act(async () => {
      backButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/operator/broadcast', {
      replace: true,
    });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('saves safety and API model payloads separately without mixing drafts', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            index: 0,
            name: 'Built-in microphone',
            input_channels: 1,
            default_sample_rate: 44100,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'echo',
          audio_device: '0',
          translation_session_auto_stop_minutes: 45,
          translation_session_warning_minutes: 3,
          translation_session_extension_minutes: 15,
          translation_session_hard_limit_minutes: 90,
          openai_key_set: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          interpreter: 'openai',
          audio_device: '0',
          translation_session_auto_stop_minutes: 90,
          translation_session_warning_minutes: 5,
          translation_session_extension_minutes: 10,
          translation_session_hard_limit_minutes: 120,
          openai_key_set: true,
          openai_key_masked: 'sk-...abcd',
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const safetyTab = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ).find(
      (button) =>
        button.textContent?.includes('안전 설정') ||
        button.textContent?.includes('Safety'),
    );
    await act(async () => {
      safetyTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const autoStopInput = container.querySelector(
      'input[name="translation_session_auto_stop_minutes"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '45');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const safetySave = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
    );
    await act(async () => {
      safetySave?.click();
    });

    const safetyPutCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/v1/operator/settings' &&
        (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(safetyPutCall).toBeDefined();
    const safetyPayload = JSON.parse(
      (safetyPutCall?.[1] as RequestInit | undefined)?.body as string,
    );
    expect(safetyPayload).toMatchObject({
      interpreter: 'echo',
      translation_session_auto_stop_minutes: 45,
    });
    expect(safetyPayload).not.toHaveProperty('openai_api_key');
    expect(safetyPayload).not.toHaveProperty('audio_device');

    const apiTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (button) =>
        button.textContent?.includes('API Model') ||
        button.textContent?.includes('API 모델'),
    );
    await act(async () => {
      apiTab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const interpreterButton = Array.from(
      container.querySelectorAll('button[aria-haspopup="listbox"]'),
    )[0] as HTMLButtonElement;
    await act(async () => {
      interpreterButton.click();
    });
    const openAiOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find((option) => option.getAttribute('aria-label') === 'OpenAI') as
      | HTMLButtonElement
      | undefined;
    expect(openAiOption).not.toBeUndefined();
    await act(async () => {
      openAiOption?.click();
    });

    const apiInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(apiInput, 'sk-test-1234');
      apiInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const apiSave = Array.from(container.querySelectorAll('button')).find(
      (button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
    );
    await act(async () => {
      apiSave?.click();
    });

    const apiPutCall = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === '/api/v1/operator/settings' &&
        (init as RequestInit | undefined)?.method === 'PUT',
    )[1];
    expect(apiPutCall).toBeDefined();
    const apiPayload = JSON.parse(
      (apiPutCall?.[1] as RequestInit | undefined)?.body as string,
    );
    expect(apiPayload).toMatchObject({
      interpreter: 'openai',
      openai_api_key: 'sk-test-1234',
    });
    expect(apiPayload).not.toHaveProperty('audio_device');
    expect(apiPayload).not.toHaveProperty(
      'translation_session_auto_stop_minutes',
    );
    expect(apiPayload).not.toHaveProperty(
      'translation_session_warning_minutes',
    );
    expect(apiPayload).not.toHaveProperty(
      'translation_session_extension_minutes',
    );
    expect(apiPayload).not.toHaveProperty(
      'translation_session_hard_limit_minutes',
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('preserves unsaved API and safety drafts across unrelated saves', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const savedSettings = {
      interpreter: 'echo',
      audio_device: '0',
      translation_session_auto_stop_minutes: 90,
      translation_session_warning_minutes: 5,
      translation_session_extension_minutes: 10,
      translation_session_hard_limit_minutes: 120,
      openai_key_set: false,
    };
    const savePayloads: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/v1/audio/devices') {
          return {
            ok: true,
            json: async () => [
              {
                index: 0,
                name: 'Built-in microphone',
                input_channels: 1,
                default_sample_rate: 44100,
              },
            ],
          };
        }
        if (init?.method === 'PUT') {
          const payload = JSON.parse(String(init.body)) as Record<
            string,
            unknown
          >;
          savePayloads.push(payload);
          Object.assign(savedSettings, payload);
          if (payload.openai_api_key) {
            savedSettings.openai_key_set = true;
          }
        }
        return {
          ok: true,
          json: async () => ({
            ...savedSettings,
            openai_key_masked: savedSettings.openai_key_set
              ? 'test...1234'
              : '',
          }),
        };
      },
    );
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const findTab = (name: string) =>
      Array.from(container.querySelectorAll('[role="tab"]')).find((tab) =>
        tab.textContent?.includes(name),
      ) as HTMLButtonElement | undefined;
    const apiTab = findTab('API 모델');
    const safetyTab = findTab('안전 설정');

    await act(async () => {
      apiTab?.click();
    });
    await act(async () => {
      (
        container.querySelector(
          'button[aria-haspopup="listbox"]',
        ) as HTMLButtonElement
      ).click();
    });
    const openAiOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find(
      (option) => option.getAttribute('aria-label') === 'OpenAI',
    ) as HTMLButtonElement;
    await act(async () => {
      openAiOption.click();
    });

    const apiKeyInput = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(apiKeyInput, 'test-key-1234');
      apiKeyInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      safetyTab?.click();
    });
    const autoStopInput = container.querySelector(
      'input[name="translation_session_auto_stop_minutes"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(autoStopInput, '45');
      autoStopInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const applyButton = () =>
      Array.from(container.querySelectorAll('button')).find((button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
      );
    await act(async () => {
      applyButton()?.click();
    });

    expect(savePayloads[0]).toMatchObject({
      interpreter: 'echo',
      translation_session_auto_stop_minutes: 45,
    });
    expect(savePayloads[0]).not.toHaveProperty('openai_api_key');

    const appearanceTab = findTab('화면');
    await act(async () => {
      appearanceTab?.click();
    });
    await act(async () => {
      (
        container.querySelector(
          'button[aria-haspopup="listbox"]',
        ) as HTMLButtonElement
      ).click();
    });
    const englishOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find(
      (option) => option.getAttribute('aria-label') === '영어',
    ) as HTMLButtonElement;
    await act(async () => {
      englishOption.click();
    });

    await act(async () => {
      apiTab?.click();
    });
    expect(
      (container.querySelector('input[type="password"]') as HTMLInputElement)
        .value,
    ).toBe('test-key-1234');
    expect(
      container.querySelector('button[aria-haspopup="listbox"]')?.textContent,
    ).toContain('OpenAI');
    expect(
      fetchMock.mock.calls.filter(
        ([url, init]) =>
          url === '/api/v1/operator/settings' && init?.method !== 'PUT',
      ),
    ).toHaveLength(1);

    await act(async () => {
      safetyTab?.click();
    });
    const warningInput = container.querySelector(
      'input[name="translation_session_warning_minutes"]',
    ) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set?.call(warningInput, '4');
      warningInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      apiTab?.click();
    });
    await act(async () => {
      applyButton()?.click();
    });
    expect(savePayloads[1]).toMatchObject({
      interpreter: 'openai',
      openai_api_key: 'test-key-1234',
    });
    expect(savePayloads[1]).not.toHaveProperty(
      'translation_session_warning_minutes',
    );

    await act(async () => {
      safetyTab?.click();
    });
    expect(
      (
        container.querySelector(
          'input[name="translation_session_warning_minutes"]',
        ) as HTMLInputElement
      ).value,
    ).toBe('4');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('rolls back a rejected device selection and explains the live-session conflict', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/v1/audio/devices') {
          return {
            ok: true,
            json: async () => [
              {
                index: 0,
                name: 'Built-in microphone',
                input_channels: 1,
                default_sample_rate: 44100,
              },
            ],
          };
        }
        if (init?.method === 'PUT') {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              detail:
                'Stop the translation session before changing the input device',
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({
            interpreter: 'echo',
            audio_device: '0',
            translation_session_auto_stop_minutes: 90,
            translation_session_warning_minutes: 5,
            translation_session_extension_minutes: 10,
            translation_session_hard_limit_minutes: 120,
            openai_key_set: false,
          }),
        };
      },
    );
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
        </OperatorPrefsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const devicesTab = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ).find((tab) => tab.textContent?.includes('입력 장치')) as
      | HTMLButtonElement
      | undefined;
    await act(async () => {
      devicesTab?.click();
    });
    await act(async () => {
      (
        container.querySelector(
          'button[aria-haspopup="listbox"]',
        ) as HTMLButtonElement
      ).click();
    });
    const defaultOption = Array.from(
      document.body.querySelectorAll('[role="option"]'),
    ).find(
      (option) => option.getAttribute('aria-label') === '시스템 기본 장치',
    ) as HTMLButtonElement;
    await act(async () => {
      defaultOption.click();
    });

    const putCall = fetchMock.mock.calls.find(
      ([, init]) => init?.method === 'PUT',
    );
    expect(JSON.parse(String(putCall?.[1]?.body))).toMatchObject({
      interpreter: 'echo',
      audio_device: 'default',
    });
    expect(container.textContent).toContain(
      '통역 세션을 중지한 뒤 입력 장치를 바꾸거나 테스트하세요.',
    );
    expect(
      container
        .querySelector('button[aria-haspopup="listbox"]')
        ?.getAttribute('aria-label'),
    ).toContain('Built-in microphone');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('shows an error toast when loading settings fails', async () => {
    installStorage({ operatorUiLanguage: 'ko', operatorUiTheme: 'light' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('device network'))
        .mockRejectedValue(new Error('network')),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OperatorPrefsProvider>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </OperatorPrefsProvider>,
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
