import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';
import { useSermonSession } from '../../src/pages/Operator/sermon-session/useSermonSession';
import { operatorCopy } from '../../src/pages/Operator/translations';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  private listeners = new Map<string, Array<(event: { data?: string }) => void>>();

  constructor(_url: string) {}

  addEventListener(type: string, listener: (event: { data?: string }) => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close() {}

  emit(type: string, data: string) {
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }
}

interface SermonSessionState {
  details: {
    title: string;
    speaker: string;
    bible_reference: string;
    bible_text: string;
    notes: string;
  };
  lifecycle: string;
  save: () => Promise<void>;
}

let latestSocket: FakeWebSocket;

function Probe({ onState }: { onState: (state: SermonSessionState) => void }) {
  const state = useSermonSession(operatorCopy.ko);
  onState(state);
  return null;
}

function mount(onState: (state: SermonSessionState) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ToastProvider>
        <Probe onState={onState} />
      </ToastProvider>,
    );
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

describe('useSermonSession', () => {
  it('loads sermon details, reflects live session status, and saves metadata', async () => {
    const savedRecord = {
      sermon_id: 'sermon-1',
      title: '주일 설교',
      speaker: '홍길동',
      bible_reference: '요한복음 3:16',
      bible_text: '하나님이 세상을 이처럼 사랑하사',
      notes: '도입부 메모',
      status: 'ready',
    };
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/v1/session') {
        return { ok: true, json: async () => ({ running: false }) };
      }
      if (init?.method === 'PUT') {
        return { ok: true, json: async () => savedRecord };
      }
      return { ok: true, json: async () => savedRecord };
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(url: string) {
        super(url);
        latestSocket = this;
      }
    });
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });

    let state!: SermonSessionState;
    const cleanup = mount((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(state.details.title).toBe('주일 설교');
    expect(state.lifecycle).toBe('ready');

    await act(async () => {
      latestSocket.emit('message', JSON.stringify({ type: 'status', running: true }));
    });
    expect(state.lifecycle).toBe('live');

    await act(async () => {
      await state.save();
    });

    const saveCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(saveCall?.[0]).toBe('/api/v1/sermon-session');
    expect(JSON.parse(String(saveCall?.[1]?.body))).toEqual({
      title: '주일 설교',
      speaker: '홍길동',
      bible_reference: '요한복음 3:16',
      bible_text: '하나님이 세상을 이처럼 사랑하사',
      notes: '도입부 메모',
    });

    cleanup();
  });

  it('refreshes the broadcast status when the operator socket closes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ready' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ running: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ running: false }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', class extends FakeWebSocket {
      constructor(url: string) {
        super(url);
        latestSocket = this;
      }
    });
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });

    let state!: SermonSessionState;
    const cleanup = mount((nextState) => {
      state = nextState;
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.lifecycle).toBe('live');

    await act(async () => {
      latestSocket.emit('close', '');
      await Promise.resolve();
    });

    expect(state.lifecycle).toBe('ready');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/session');
    cleanup();
  });
});