import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Listen from '../../src/pages/Listen/Listen';
import { useBroadcastSession } from '../../src/pages/Operator/broadcast/hooks/useBroadcastSession';
import { operatorCopy } from '../../src/pages/Operator/translations';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockAudioContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {} as AudioDestinationNode;

  async resume() {
    this.state = 'running';
  }

  async close() {
    this.state = 'closed';
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }

  createBufferSource() {
    return {
      connect: vi.fn(),
      start: vi.fn(),
    } as unknown as AudioBufferSourceNode;
  }
}

class MockWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];

  binaryType = 'arraybuffer';
  readyState = MockWebSocket.OPEN;

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  message(payload: object) {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(payload) }),
    );
  }

  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}

const storedValues = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return storedValues.size;
  },
  clear: () => storedValues.clear(),
  getItem: (key) => storedValues.get(key) ?? null,
  key: (index) => Array.from(storedValues.keys())[index] ?? null,
  removeItem: (key) => storedValues.delete(key),
  setItem: (key, value) => storedValues.set(key, value),
};

function renderListener() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Listen />));
  return { container, root };
}

function renderOperator() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const sessionRef: { current: ReturnType<typeof useBroadcastSession> | null } =
    { current: null };

  function Probe() {
    sessionRef.current = useBroadcastSession(operatorCopy.ko);
    return null;
  }

  act(() => root.render(<Probe />));
  return { container, root, sessionRef };
}

async function click(element: HTMLElement | null) {
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  MockWebSocket.instances = [];
  storedValues.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost' });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ running: false, listener_count: 0 }),
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('core live broadcast flow', () => {
  it('keeps operator and listener aligned from OFF through LIVE and final auto-stop', async () => {
    const operator = renderOperator();
    const listener = renderListener();
    const operatorSocket = MockWebSocket.instances[0];
    const listenerSocket = MockWebSocket.instances[1];

    expect(operatorSocket).toBeDefined();
    expect(listenerSocket).toBeDefined();

    act(() => {
      operatorSocket?.open();
      listenerSocket?.open();
      operatorSocket?.message({
        type: 'translation_status',
        session_status: 'off',
        running: false,
        listener_count: 1,
      });
      listenerSocket?.message({
        type: 'translation_status',
        session_status: 'off',
        last_termination_reason: null,
      });
    });

    expect(operator.sessionRef.current?.sessionStatus).toBe('off');
    expect(listener.container).toHaveTextContent('VERBUNDEN · ÜBERSETZUNG AUS');
    expect(
      listener.container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();

    act(() => {
      operatorSocket?.message({
        type: 'translation_status',
        session_status: 'live',
        running: true,
        audio_ready: true,
        listener_count: 1,
      });
      listenerSocket?.message({
        type: 'translation_status',
        session_status: 'live',
      });
      listenerSocket?.message({ text: 'Guten Morgen.' });
    });

    expect(operator.sessionRef.current?.sessionStatus).toBe('live');
    expect(operator.sessionRef.current?.listenerCount).toBe(1);
    expect(listener.container).toHaveTextContent('SESSION LIVE · DEUTSCH');
    expect(listener.container).toHaveTextContent('Guten Morgen.');

    await click(
      listener.container.querySelector('button[aria-label="Start listening"]'),
    );
    expect(
      listener.container.querySelector('button[aria-label="Stop listening"]'),
    ).not.toBeNull();

    act(() => {
      operatorSocket?.message({
        type: 'session_ended',
        reason: 'auto_stop',
      });
      listenerSocket?.message({
        type: 'session_ended',
        reason: 'auto_stop',
      });
    });

    expect(operator.sessionRef.current?.lastTerminationReason).toBe(
      operatorCopy.ko.terminationAutoStop,
    );
    expect(listener.container).toHaveTextContent('SENDUNG BEENDET');

    act(() => {
      operator.root.unmount();
      listener.root.unmount();
    });
  });

  it('distinguishes interpreter error from a normal ended broadcast', () => {
    const operator = renderOperator();
    const listener = renderListener();
    const operatorSocket = MockWebSocket.instances[0];
    const listenerSocket = MockWebSocket.instances[1];

    act(() => {
      operatorSocket?.open();
      listenerSocket?.open();
      operatorSocket?.message({
        type: 'translation_status',
        session_status: 'error',
        running: false,
        last_termination_reason: 'interpreter_error',
      });
      listenerSocket?.message({
        type: 'translation_status',
        session_status: 'error',
        last_termination_reason: 'interpreter_error',
      });
      listenerSocket?.message({
        type: 'session_ended',
        reason: 'interpreter_error',
      });
    });

    expect(operator.sessionRef.current?.sessionStatus).toBe('error');
    expect(operator.sessionRef.current?.lastTerminationReason).toBe(
      operatorCopy.ko.terminationInterpreterError,
    );
    expect(listener.container).toHaveTextContent('ÜBERSETZUNG NICHT VERFÜGBAR');
    expect(listener.container).not.toHaveTextContent('SENDUNG BEENDET');

    act(() => {
      operator.root.unmount();
      listener.root.unmount();
    });
  });

  it('reconnects the listener socket without losing the OFF state', async () => {
    vi.useFakeTimers();
    const listener = renderListener();
    const firstSocket = MockWebSocket.instances[0];

    await click(
      listener.container.querySelector('button[aria-label="Listen"]'),
    );

    act(() => {
      firstSocket?.open();
      firstSocket?.message({
        type: 'translation_status',
        session_status: 'off',
      });
    });
    expect(listener.container).toHaveTextContent('VERBUNDEN · ÜBERSETZUNG AUS');

    act(() => firstSocket?.close());
    expect(listener.container).toHaveTextContent(
      'VERBINDUNG UNTERBROCHEN · VERBINDET ERNEUT',
    );

    act(() => vi.advanceTimersByTime(1200));
    const secondSocket = MockWebSocket.instances[1];
    act(() => {
      secondSocket?.open();
      secondSocket?.message({
        type: 'translation_status',
        session_status: 'off',
      });
    });
    expect(listener.container).toHaveTextContent('VERBUNDEN · ÜBERSETZUNG AUS');

    act(() => listener.root.unmount());
  });
});
