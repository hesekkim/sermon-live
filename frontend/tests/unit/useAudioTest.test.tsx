import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Settings from '../../src/pages/Operator/settings/Settings';
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
    isSaving: false,
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

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({
  selectedDevice = '',
  onRender,
}: {
  selectedDevice?: string;
  onRender: (state: ReturnType<typeof useAudioTest>) => void;
}) {
  const state = useAudioTest(selectedDevice);
  onRender(state);
  return null;
}

function renderProbe(
  onRender: (state: ReturnType<typeof useAudioTest>) => void,
  selectedDevice = ''
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Probe onRender={onRender} selectedDevice={selectedDevice} />);
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

function streamResponse(events: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      });
      controller.close();
    },
  });
  return { ok: true, body };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('useAudioTest', () => {
  it('posts the audio test request and stores the detected input metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ...streamResponse([
        { type: 'level', input_level_dbfs: -36.25 },
        { type: 'level', input_level_dbfs: -12.5 },
        {
          type: 'result',
          status: 'signal',
          detected_sample_rate: 48000,
          detected_channels: 2,
          detected_sample_width: 2,
          input_level_dbfs: -12.5,
          processing_sample_rate: 24000,
          processing_channels: 1,
          processing_sample_width: 2,
          processing_success: true,
          message: 'Audio device is accessible and ready for processing',
        },
      ]),
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
      '/api/v1/audio/test/stream',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_device: '1' }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(state.result?.status).toBe('signal');
    expect(state.result?.detected_sample_rate).toBe(48000);
    expect(state.result?.input_level_dbfs).toBe(-12.5);
    expect(state.liveInputLevel).toBe(-12.5);
    expect(state.error).toBeNull();

    cleanup();
  });

  it('exposes a human-readable error when the audio test fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ detail: 'No device found' }) })
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

  it('disables the audio test button until a device is selected', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <ToastProvider>
            <Settings />
          </ToastProvider>
        </MemoryRouter>
      );
    });

    const devicesTab = Array.from(container.querySelectorAll('[role="tab"]')).find((element) =>
      element.textContent?.includes('입력 장치')
    ) as HTMLButtonElement | undefined;
    act(() => devicesTab?.click());

    const button = Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === '오디오 테스트'
    );

    expect(button).not.toBeUndefined();
    expect(button).toBeDisabled();

    act(() => root.unmount());
    container.remove();
  });
});
