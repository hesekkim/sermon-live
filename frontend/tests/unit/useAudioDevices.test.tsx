import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioDevices } from '../../src/pages/Operator/settings/hooks/useAudioDevices';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

interface AudioDevicesState {
  devices: Array<{ index: number; name: string; input_channels: number; default_sample_rate: number }>;
  deviceOptions: Array<{ value: string; label: string }>;
  selectedDevice: string;
  setSelectedDevice: (device: string) => void;
  error: string | null;
}

function Probe({ onRender }: { onRender: (state: AudioDevicesState) => void }) {
  const state = useAudioDevices();
  onRender(state as AudioDevicesState);
  return null;
}

function renderProbe(onRender: (state: AudioDevicesState) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Probe onRender={onRender} />);
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('useAudioDevices', () => {
  it('preserves a saved device while the device list is loading', async () => {
    let resolveFetch!: (response: {
      ok: boolean;
      json: () => Promise<unknown>;
    }) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      )
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    act(() => {
      state.setSelectedDevice('1');
    });
    expect(state.selectedDevice).toBe('1');

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => [
          { index: 0, name: 'Built-in microphone', input_channels: 1, default_sample_rate: 44100 },
          { index: 1, name: 'USB Audio', input_channels: 2, default_sample_rate: 48000 },
        ],
      });
    });

    expect(state.selectedDevice).toBe('1');
    cleanup();
  });

  it('loads entry devices and updates the selected device', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { index: 0, name: 'Built-in microphone', input_channels: 1, default_sample_rate: 44100 },
          { index: 1, name: 'USB Audio', input_channels: 2, default_sample_rate: 48000 },
        ],
      })
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.devices).toHaveLength(2);
    expect(state.deviceOptions[1].value).toBe('1');
    expect(state.error).toBeNull();

    act(() => {
      state.setSelectedDevice('1');
    });

    expect(state.selectedDevice).toBe('1');

    cleanup();
  });

  it('exposes an error when the device request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.error).toBe('기기를 불러오지 못했습니다');

    cleanup();
  });

  it('treats an empty device list as a load failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.devices).toEqual([]);
    expect(state.deviceOptions).toEqual([]);
    expect(state.error).toBe('기기를 불러오지 못했습니다');

    cleanup();
  });

  it('restores the saved device when it still exists and clears stale selections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { index: 0, name: 'Built-in microphone', input_channels: 1, default_sample_rate: 44100 },
          { index: 1, name: 'USB Audio', input_channels: 2, default_sample_rate: 48000 },
        ],
      })
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      state.setSelectedDevice('1');
    });
    expect(state.selectedDevice).toBe('1');

    act(() => {
      state.setSelectedDevice('99');
    });
    expect(state.selectedDevice).toBe('');

    cleanup();
  });
});
