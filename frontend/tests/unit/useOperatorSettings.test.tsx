import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { operatorCopy } from '../../src/pages/Operator/translations';
import { useOperatorSettings } from '../../src/pages/Operator/settings/hooks/useOperatorSettings';

const { operatorFetchMock, errorMock } = vi.hoisted(() => ({
  operatorFetchMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('../../src/pages/Operator/auth/operatorAuthApi', () => ({
  operatorFetch: operatorFetchMock,
}));

vi.mock('../../src/shared/components/Toast/ToastProvider', () => ({
  useToast: () => ({
    error: errorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({
  onRender,
}: {
  onRender: (state: ReturnType<typeof useOperatorSettings>) => void;
}) {
  const state = useOperatorSettings({
    labels: operatorCopy.ko,
    language: 'ko',
    setSelectedDevice: vi.fn(),
    setSelectedChannel: vi.fn(),
  });
  onRender(state);
  return null;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('useOperatorSettings', () => {
  it('does not save device settings before the current settings have loaded', async () => {
    operatorFetchMock.mockReturnValue(new Promise(() => undefined));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latestState: ReturnType<typeof useOperatorSettings> | undefined;

    await act(async () => {
      root.render(<Probe onRender={(state) => (latestState = state)} />);
    });

    let result:
      | Awaited<ReturnType<NonNullable<typeof latestState>['saveDevice']>>
      | undefined;
    await act(async () => {
      result = await latestState?.saveDevice('another-device', 1);
    });

    expect(result).toEqual({
      success: false,
      message: operatorCopy.ko.settingsLoadFailed,
    });
    expect(operatorFetchMock).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it('shows the sanitized key warning sent by the server for invalid API keys', async () => {
    const serverWarning = 'OpenAI API key is invalid';
    operatorFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        interpreter: 'openai',
        translation_target_language: 'de',
        openai_key_set: true,
        openai_key_status: 'invalid',
        openai_key_warning: serverWarning,
      }),
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latestState: ReturnType<typeof useOperatorSettings> | undefined;

    await act(async () => {
      root.render(<Probe onRender={(state) => (latestState = state)} />);
    });

    expect(latestState?.settingsLoadStatus).toBe('loaded');
    expect(latestState?.interpreter).toBe('openai');
    expect(latestState?.openaiKeyStatus).toBe('invalid');
    expect(latestState?.openaiKeyWarning).toBe(serverWarning);

    act(() => root.unmount());
    container.remove();
  });

  it('saves the selected translation target language with API settings', async () => {
    const settings = {
      interpreter: 'echo',
      translation_target_language: 'de',
      openai_key_set: false,
    };
    operatorFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => settings,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...settings, translation_target_language: 'en' }),
      });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let latestState: ReturnType<typeof useOperatorSettings> | undefined;

    await act(async () => {
      root.render(<Probe onRender={(state) => (latestState = state)} />);
    });
    await act(async () => {
      latestState?.setTranslationTargetLanguage('en');
    });

    expect(latestState?.isApiModelDirty).toBe(true);

    let result: Awaited<
      ReturnType<NonNullable<typeof latestState>['saveApiModel']>
    > | undefined;
    await act(async () => {
      result = await latestState!.saveApiModel();
    });

    expect(result).toEqual({ success: true });
    expect(JSON.parse(operatorFetchMock.mock.calls[1][1].body)).toEqual({
      interpreter: 'echo',
      translation_target_language: 'en',
    });
    expect(latestState?.translationTargetLanguage).toBe('en');

    act(() => root.unmount());
    container.remove();
  });
});
