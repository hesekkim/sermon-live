import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Settings from '../../src/pages/Operator/settings/Settings';
import AudioTestPanel from '../../src/pages/Operator/settings/components/AudioTestPanel';
import { operatorCopy } from '../../src/pages/Operator/translations';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';
import { useAudioTest } from '../../src/pages/Operator/settings/hooks/useAudioTest';

vi.mock('../../src/pages/Operator/OperatorPrefs', () => ({
  useOperatorPrefs: () => ({
    labels: operatorCopy.ko,
    language: 'ko',
    theme: 'light',
    setLanguage: vi.fn(),
    setTheme: vi.fn(),
  }),
}));

vi.mock('../../src/pages/Operator/settings/hooks/useAudioDevices', () => ({
  useAudioDevices: () => ({
    devices: [],
    deviceOptions: [],
    selectedDevice: '',
    setSelectedDevice: vi.fn(),
    isLoading: false,
    error: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('../../src/pages/Operator/settings/hooks/useOperatorSettings', () => ({
  useOperatorSettings: () => ({
    interpreter: 'echo',
    setInterpreter: vi.fn(),
    apiKey: '',
    setApiKey: vi.fn(),
    openaiKeyStatus: 'missing',
    openaiKeyMasked: '',
    keyWarning: '',
    draftLanguage: 'ko',
    setDraftLanguage: vi.fn(),
    draftTheme: 'light',
    setDraftTheme: vi.fn(),
    timerValues: {
      autoStopMinutes: '90',
      warningMinutes: '5',
      extensionMinutes: '10',
      hardLimitMinutes: '120',
    },
    isSaving: false,
    isSafetyDirty: true,
    isApiModelDirty: true,
    setTimerValue: vi.fn(),
    timerValidation: { fieldErrors: {}, hasErrors: false, message: '' },
    saveDevice: vi.fn(),
    saveSafety: vi.fn(),
    saveApiModel: vi.fn(),
  }),
}));

vi.mock('../../../src/shared/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  }),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({
  selectedDevice = '',
  timeoutMessage,
  onRender,
}: {
  selectedDevice?: string;
  timeoutMessage?: string;
  onRender: (state: ReturnType<typeof useAudioTest>) => void;
}) {
  const state = useAudioTest(selectedDevice, timeoutMessage);
  onRender(state);
  return null;
}

function renderProbe(
  onRender: (state: ReturnType<typeof useAudioTest>) => void,
  selectedDevice = '',
  timeoutMessage?: string,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <Probe
        onRender={onRender}
        selectedDevice={selectedDevice}
        timeoutMessage={timeoutMessage}
      />,
    );
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('useAudioTest', () => {
  it('posts the audio test request and stores the capture stream format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'signal',
        capture_sample_rate: 48000,
        capture_channels: 2,
        capture_sample_width: 2,
        input_level_dbfs: -12.5,
        processing_sample_rate: 24000,
        processing_channels: 1,
        processing_sample_width: 2,
        processing_success: true,
        message: 'Audio device is accessible and ready for processing',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    let state!: ReturnType<typeof useAudioTest>;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    }, '1');

    await act(async () => {
      await state.runTest();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/audio/test',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({ audio_device: '1' }),
        signal: expect.any(AbortSignal),
      }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(request.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(state.result?.status).toBe('signal');
    expect(state.result?.capture_sample_rate).toBe(48000);
    expect(state.result?.input_level_dbfs).toBe(-12.5);
    expect(state.liveInputLevel).toBe(-12.5);
    expect(state.error).toBeNull();

    cleanup();
  });

  it('exposes a human-readable error when the audio test fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: 'No device found' }),
      }),
    );

    let state!: ReturnType<typeof useAudioTest>;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await state.runTest();
    });

    expect(state.error).toBe('No device found');
    expect(state.result).toBeNull();

    cleanup();
  });

  it('stops a pending system-default audio test', async () => {
    const previousResult = {
      status: 'signal' as const,
      capture_sample_rate: 48000,
      capture_channels: 2,
      capture_sample_width: 2,
      input_level_dbfs: -12,
      processing_sample_rate: 24000,
      processing_channels: 1,
      processing_sample_width: 2,
      processing_success: true,
      message: 'Previous test result',
    };
    let requestCount = 0;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve({
          ok: true,
          json: async () => previousResult,
        } as Response);
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    let state!: ReturnType<typeof useAudioTest>;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    }, 'default');
    await act(async () => {
      await state.runTest();
    });
    expect(state.result).toEqual(previousResult);
    expect(state.liveInputLevel).toBe(-12);

    let testPromise!: Promise<Awaited<ReturnType<typeof state.runTest>>>;

    act(() => {
      testPromise = state.runTest();
    });
    expect(state.isTesting).toBe(true);
    expect(state.result).toBeNull();
    expect(state.liveInputLevel).toBeNull();

    await act(async () => {
      state.stopTest();
      await testPromise;
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/audio/test',
      expect.objectContaining({
        body: JSON.stringify({ audio_device: 'default' }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(state.isTesting).toBe(false);
    expect(state.error).toBeNull();
    expect(state.result).toBeNull();
    expect(state.liveInputLevel).toBeNull();

    cleanup();
  });

  it('ends a stalled test and reports a timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    let state!: ReturnType<typeof useAudioTest>;
    const cleanup = renderProbe(
      (nextState) => {
        state = nextState;
      },
      'default',
      '오디오 테스트 timeout',
    );
    let testPromise!: Promise<Awaited<ReturnType<typeof state.runTest>>>;

    act(() => {
      testPromise = state.runTest();
    });
    expect(state.isTesting).toBe(true);

    await act(async () => {
      await vi.runAllTimersAsync();
      await testPromise;
    });

    expect(state.isTesting).toBe(false);
    expect(state.error).toBe('오디오 테스트 timeout');
    expect(state.result).toBeNull();

    cleanup();
  });

  it('shows the running label instead of the not-tested label during a test', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AudioTestPanel
          labels={operatorCopy.ko}
          result={null}
          liveInputLevel={null}
          runtimeInputLevel={null}
          error={null}
          isTesting
          canRun
          onRun={vi.fn()}
          onStop={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('strong')?.textContent).toBe(
      operatorCopy.ko.audioTestRunning,
    );

    act(() => root.unmount());
    container.remove();
  });

  it('uses the broadcast input level while testing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AudioTestPanel
          labels={operatorCopy.ko}
          result={null}
          liveInputLevel={-42}
          runtimeInputLevel={-18}
          error={null}
          isTesting
          canRun
          onRun={vi.fn()}
          onStop={vi.fn()}
        />,
      );
    });

    expect(
      container.querySelector('[role="meter"]')?.getAttribute('aria-valuenow'),
    ).toBe('-18');

    act(() => root.unmount());
    container.remove();
  });

  it('allows the system default input when no device is selected', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    const devicesTab = Array.from(
      container.querySelectorAll('[role="tab"]'),
    ).find((element) => element.textContent?.includes('입력 장치')) as
      | HTMLButtonElement
      | undefined;
    act(() => devicesTab?.click());

    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === '오디오 테스트',
    );

    expect(button).not.toBeUndefined();
    expect(button).toBeEnabled();

    act(() => root.unmount());
    container.remove();
  });

  it('disables device changes and audio tests while a translation session is active', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/operator/settings']}>
          <Routes>
            <Route
              path="/operator"
              element={<Outlet context={{ isSessionBusy: true }} />}
            >
              <Route
                path="settings"
                element={
                  <ToastProvider>
                    <Settings />
                  </ToastProvider>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    const devicesTab = container.querySelector<HTMLButtonElement>(
      '#settings-tab-devices',
    );
    act(() => devicesTab?.click());

    const deviceSelect = container.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="listbox"]',
    );
    const audioTestButton = Array.from(
      container.querySelectorAll('button'),
    ).find((button) => button.textContent === '오디오 테스트');

    expect(deviceSelect).toBeDisabled();
    expect(audioTestButton).toBeDisabled();
    expect(container.textContent).toContain(
      '통역 세션을 중지한 뒤 입력 장치를 바꾸거나 테스트하세요.',
    );

    act(() => root.unmount());
    container.remove();
  });

  it('disables safety and API model settings while a translation session is active', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/operator/settings']}>
          <Routes>
            <Route
              path="/operator"
              element={<Outlet context={{ isSessionBusy: true }} />}
            >
              <Route
                path="settings"
                element={
                  <ToastProvider>
                    <Settings />
                  </ToastProvider>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    act(() =>
      container
        .querySelector<HTMLButtonElement>('#settings-tab-safety')
        ?.click(),
    );
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="translation_session_auto_stop_minutes"]',
      ),
    ).toBeDisabled();
    expect(
      Array.from(container.querySelectorAll('button')).find((button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
      ),
    ).toBeDisabled();

    act(() =>
      container.querySelector<HTMLButtonElement>('#settings-tab-api')?.click(),
    );
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-haspopup="listbox"]',
      ),
    ).toBeDisabled();
    expect(
      container.querySelector<HTMLInputElement>('input[type="password"]'),
    ).toBeDisabled();
    expect(
      Array.from(container.querySelectorAll('button')).find((button) =>
        ['적용', 'Apply', 'Anwenden'].includes(
          button.textContent?.trim() ?? '',
        ),
      ),
    ).toBeDisabled();

    act(() => root.unmount());
    container.remove();
  });
});
