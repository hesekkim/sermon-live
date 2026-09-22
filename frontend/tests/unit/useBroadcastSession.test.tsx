import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBroadcastSession } from '../../src/pages/Operator/broadcast/useBroadcastSession';
import { operatorCopy } from '../../src/pages/Operator/translations';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static latest: FakeWebSocket | null = null;
  readyState = FakeWebSocket.OPEN;
  private listeners = new Map<string, Array<() => void>>();

  constructor(_url: string) {
    FakeWebSocket.latest = this;
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {}

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
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
    vi.restoreAllMocks();
    document.body.replaceChildren();
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
