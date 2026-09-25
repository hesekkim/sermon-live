import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBroadcastSession } from '../../src/pages/Operator/broadcast/hooks/useBroadcastSession';
import { operatorCopy } from '../../src/pages/Operator/translations';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static latest: FakeWebSocket | null = null;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  private listeners = new Map<string, Array<(event?: { data?: string }) => void>>();

  constructor(_url: string) {
    FakeWebSocket.latest = this;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event?: { data?: string }) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {}

  emit(type: string, payload?: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: payload });
    }
  }
}

function Probe({ onError }: { onError: (message: string) => void }) {
  useBroadcastSession(operatorCopy.ko, onError);
  return null;
}

describe('useBroadcastSession', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ running: false, listener_count: 0 }),
    }));
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
  });

  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('does not reopen the operator socket when the component re-renders', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderProbe = (messageHandler: (message: string) => void) => {
      root.render(<Probe onError={messageHandler} />);
    };

    await act(async () => {
      renderProbe(() => undefined);
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      renderProbe(() => undefined);
      await Promise.resolve();
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => root.unmount());
  });

  it('tracks audio level changes and resets stale values', async () => {
    let latestAudioLevel: number | null = null;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function AudioLevelProbe() {
      const { audioLevel } = useBroadcastSession(operatorCopy.ko);
      latestAudioLevel = audioLevel;
      return null;
    }

    await act(async () => {
      root.render(<AudioLevelProbe />);
      await Promise.resolve();
    });

    const instance = FakeWebSocket.latest;
    expect(instance).not.toBeNull();

    await act(async () => {
      instance?.emit('message', JSON.stringify({ type: 'audio_level', level: -12 }));
      instance?.emit('message', JSON.stringify({ type: 'audio_level', level: 42 }));
      instance?.emit('message', JSON.stringify({ type: 'status', running: false }));
    });

    expect(latestAudioLevel).toBeNull();

    await act(async () => {
      instance?.emit('message', JSON.stringify({ type: 'audio_level', level: -45 }));
      instance?.emit('message', JSON.stringify({ type: 'audio_level', level: Number.NaN }));
    });

    expect(latestAudioLevel).toBe(-45);

    await act(async () => {
      instance?.emit('close');
    });

    expect(latestAudioLevel).toBeNull();
    act(() => root.unmount());
  });

  it('reports a WebSocket error and following close only once', async () => {
    const errors: string[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Probe onError={(message) => errors.push(message)} />);
      await Promise.resolve();
    });

    const instance = FakeWebSocket.latest;
    expect(instance).not.toBeNull();

    await act(async () => {
      instance?.emit('error');
      instance?.emit('close');
    });

    expect(errors).toEqual(['방송 처리 중 오류가 발생했습니다']);
    act(() => root.unmount());
  });
});
