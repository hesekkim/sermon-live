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
    vi.useRealTimers();
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

  it('updates operational status from operator messages and recovers the connection', async () => {
    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });

    const firstSocket = FakeWebSocket.latest;
    expect(firstSocket).not.toBeNull();

    await act(async () => {
      firstSocket?.emit('open');
      firstSocket?.emit('message', JSON.stringify({
        type: 'status',
        running: true,
        sessionStatus: 'live',
        audioReady: true,
        startAvailable: false,
        startBlockReason: null,
        listenerCount: 4,
        timer: { elapsedSeconds: 65, remainingSeconds: 535, warning: false },
      }));
      firstSocket?.emit('message', JSON.stringify({ type: 'latency', milliseconds: 180 }));
      firstSocket?.emit('message', JSON.stringify({ type: 'session_ended', reason: 'auto_stop' }));
    });

    expect(latestSession.current?.serverStatus).toBe('online');
    expect(latestSession.current?.operatorConnectionStatus).toBe('connected');
    expect(latestSession.current?.running).toBe(false);
    expect(latestSession.current?.sessionStatus).toBe('off');
    expect(latestSession.current?.audioReady).toBe(true);
    expect(latestSession.current?.startAvailable).toBe(false);
    expect(latestSession.current?.listenerCount).toBe(4);
    expect(latestSession.current?.latencyMs).toBe(180);
    expect(latestSession.current?.timer).toBeNull();
    expect(latestSession.current?.lastTerminationReason).toBe(operatorCopy.ko.terminationAutoStop);

    await act(async () => {
      firstSocket?.emit('message', JSON.stringify({
        type: 'status',
        running: true,
        session_status: 'live',
      }));
    });
    expect(latestSession.current?.running).toBe(false);
    expect(latestSession.current?.sessionStatus).toBe('off');

    vi.useFakeTimers();
    act(() => firstSocket?.emit('close'));
    expect(latestSession.current?.serverStatus).toBe('online');
    expect(latestSession.current?.operatorConnectionStatus).toBe('reconnecting');

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    const recoveredSocket = FakeWebSocket.latest;
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => recoveredSocket?.emit('open'));
    expect(latestSession.current?.operatorConnectionStatus).toBe('connected');
    act(() => root.unmount());
  });

  it('does not restore live from a status without running after termination', async () => {
    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });

    const socket = FakeWebSocket.latest;
    await act(async () => {
      socket?.emit('message', JSON.stringify({ type: 'session_ended', reason: 'auto_stop' }));
      socket?.emit('message', JSON.stringify({ type: 'status', session_status: 'live' }));
    });

    expect(latestSession.current?.running).toBe(false);
    expect(latestSession.current?.sessionStatus).toBe('off');
    act(() => root.unmount());
  });

  it('ignores a status poll started before a failed session start', async () => {
    let resolveStaleStatus!: (response: {
      ok: boolean;
      json: () => Promise<{ running: boolean; listener_count: number }>;
    }) => void;
    const staleStatus = new Promise<{
      ok: boolean;
      json: () => Promise<{ running: boolean; listener_count: number }>;
    }>((resolve) => {
      resolveStaleStatus = resolve;
    });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/start')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ detail: 'start failed' }),
        });
      }
      return staleStatus;
    }));

    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });
    const socket = FakeWebSocket.latest;
    act(() => socket?.emit('message', JSON.stringify({ type: 'session_ended', reason: 'auto_stop' })));

    await act(async () => {
      await expect(latestSession.current?.start()).rejects.toThrow('start failed');
    });
    await act(async () => {
      resolveStaleStatus({
        ok: true,
        json: async () => ({ running: true, listener_count: 0 }),
      });
      await staleStatus;
    });

    expect(latestSession.current?.running).toBe(false);
    expect(latestSession.current?.sessionStatus).toBe('off');
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

  it('keeps interpreter errors visible while status polling reports a running session', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ running: true, listener_count: 0 }),
    }));
    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });

    const socket = FakeWebSocket.latest;
    act(() => socket?.emit('message', JSON.stringify({ type: 'error', text: 'interpreter failed' })));
    expect(latestSession.current?.interpreterStatus).toBe('error');
    expect(latestSession.current?.sessionStatus).toBe('error');
    expect(latestSession.current?.sessionError).toBe('interpreter failed');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(latestSession.current?.interpreterStatus).toBe('error');
    act(() => root.unmount());
  });

  it.each([
    ['manual', operatorCopy.ko.terminationManual, 'off'],
    ['auto_stop', operatorCopy.ko.terminationAutoStop, 'off'],
    ['hard_limit', operatorCopy.ko.terminationHardLimit, 'off'],
    ['server_shutdown', operatorCopy.ko.terminationServerShutdown, 'off'],
    ['interpreter_error', operatorCopy.ko.terminationInterpreterError, 'error'],
    ['device_error', operatorCopy.ko.terminationDeviceError, 'error'],
  ] as const)('normalizes %s termination', async (reason, label, status) => {
    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = { current: null };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });
    await act(async () => {
      FakeWebSocket.latest?.emit('message', JSON.stringify({ type: 'session_ended', reason }));
    });

    expect(latestSession.current?.running).toBe(false);
    expect(latestSession.current?.sessionStatus).toBe(status);
    expect(latestSession.current?.lastTerminationReason).toBe(label);
    expect(latestSession.current?.lastTerminationReason).not.toContain('_');
    act(() => root.unmount());
  });

  it('supports timer extension during the warning window and clears stale timer data afterward', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ running: true, session_status: 'live', listener_count: 2, timer: { elapsedSeconds: 90, remainingSeconds: 60, warning: true, extensionCount: 0 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ running: true, session_status: 'live', listener_count: 2, timer: { elapsedSeconds: 100, remainingSeconds: 120, warning: false, extensionCount: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ running: false, session_status: 'off', listener_count: 0 }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const latestSession: { current: ReturnType<typeof useBroadcastSession> | null } = {
      current: null,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function StateProbe() {
      latestSession.current = useBroadcastSession(operatorCopy.ko);
      return null;
    }

    await act(async () => {
      root.render(<StateProbe />);
      await Promise.resolve();
    });

    expect(latestSession.current?.timer?.remainingSeconds).toBe(60);

    await act(async () => {
      await latestSession.current?.extend();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/session/extend', { method: 'POST' });
    expect(latestSession.current?.timer?.extensionCount).toBe(1);
    expect(latestSession.current?.timer?.warning).toBe(false);

    await act(async () => {
      latestSession.current?.setTimer(null);
    });

    expect(latestSession.current?.timer).toBeNull();
    act(() => root.unmount());
  });
});
