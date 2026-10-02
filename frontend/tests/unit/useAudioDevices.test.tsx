import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAudioDevices } from '../../src/pages/Operator/settings/hooks/useAudioDevices';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

interface AudioDevicesState {
  devices: Array<{
    index: number;
    name: string;
    host_api: string;
    selector: string;
    input_channels: number;
    default_sample_rate: number;
  }>;
  deviceOptions: Array<{ value: string; label: string }>;
  selectedDevice: string;
  setSelectedDevice: (device: string) => void;
  listMode: 'standard' | 'all';
  setListMode: (mode: 'standard' | 'all') => void;
  isSelectionStale: boolean;
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: boolean;
}

function makeDevice(index: number, name: string, inputChannels: number, rate: number) {
  const hostApi = 'Core Audio';
  return {
    index,
    name,
    host_api: hostApi,
    selector: JSON.stringify({ host_api: hostApi, name, version: 1 }),
    input_channels: inputChannels,
    default_sample_rate: rate,
  };
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
          }),
      ),
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    expect(state.isLoading).toBe(true);
    const savedSelector = makeDevice(1, 'USB Audio', 2, 48000).selector;
    act(() => {
      state.setSelectedDevice(savedSelector);
    });
    expect(state.selectedDevice).toBe(savedSelector);

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => [
          makeDevice(0, 'Built-in microphone', 1, 44100),
          makeDevice(1, 'USB Audio', 2, 48000),
        ],
      });
    });

    expect(state.selectedDevice).toBe(savedSelector);
    expect(state.isSelectionStale).toBe(false);
    cleanup();
  });

  it('loads entry devices and updates the selected device', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          makeDevice(0, 'Built-in microphone', 1, 44100),
          makeDevice(1, 'USB Audio', 2, 48000),
        ],
      }),
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.devices).toHaveLength(2);
    expect(state.deviceOptions[1].value).toBe(state.devices[1].selector);
    expect(state.error).toBe(false);
    expect(state.isLoading).toBe(false);

    act(() => {
      state.setSelectedDevice(state.devices[1].selector);
    });

    expect(state.selectedDevice).toBe(state.devices[1].selector);

    cleanup();
  });

  it('refreshes the input device list and includes newly available devices', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [makeDevice(0, 'Built-in microphone', 1, 44100)],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeDevice(0, 'Built-in microphone', 1, 44100),
          makeDevice(1, 'USB Audio', 2, 48000),
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await state.refresh();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.deviceOptions).toHaveLength(2);
    expect(state.deviceOptions[1].label).toBe('USB Audio · Core Audio (48000 Hz)');

    cleanup();
  });

  it('preserves Unicode device names in option labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [makeDevice(0, 'Kopfhörer', 1, 48000)],
      }),
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.deviceOptions[0].label).toBe('Kopfhörer · Core Audio (48000 Hz)');
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

    expect(state.error).toBe(true);
    expect(state.isLoading).toBe(false);

    cleanup();
  });

  it('treats an empty device list separately from a load failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
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
    expect(state.error).toBe(false);
    expect(state.isLoading).toBe(false);

    cleanup();
  });

  it('preserves unavailable saved selectors so the UI can request reselection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          makeDevice(0, 'Built-in microphone', 1, 44100),
          makeDevice(1, 'USB Audio', 2, 48000),
        ],
      }),
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      state.setSelectedDevice(state.devices[1].selector);
    });
    expect(state.selectedDevice).toBe(state.devices[1].selector);
    expect(state.isSelectionStale).toBe(false);

    act(() => {
      state.setSelectedDevice('USB Audio');
    });
    expect(state.selectedDevice).toBe(state.devices[1].selector);
    expect(state.isSelectionStale).toBe(false);

    act(() => {
      state.setSelectedDevice('99');
    });
    expect(state.selectedDevice).toBe('99');
    expect(state.isSelectionStale).toBe(true);

    cleanup();
  });

  it('preserves the system default selection when the device list loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [makeDevice(0, 'Built-in microphone', 1, 44100)],
      }),
    );

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    act(() => {
      state.setSelectedDevice('default');
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(state.selectedDevice).toBe('default');
    cleanup();
  });

  it('reloads the list when switching to all host APIs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [makeDevice(0, 'Built-in microphone', 1, 44100)],
    });
    vi.stubGlobal('fetch', fetchMock);

    let state!: AudioDevicesState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
    });
    act(() => state.setListMode('all'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/audio/devices?mode=standard',
      '/api/v1/audio/devices?mode=all',
    ]);
    expect(state.listMode).toBe('all');
    cleanup();
  });
});
