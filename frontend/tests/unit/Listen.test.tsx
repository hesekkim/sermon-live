import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Listen from '../../src/pages/Listen/Listen';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockAudioContext {
  static instances: MockAudioContext[] = [];
  static resumeGates: Promise<void>[] = [];
  static sources: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {} as AudioDestinationNode;

  constructor() {
    MockAudioContext.instances.push(this);
  }

  async resume() {
    const gate = MockAudioContext.resumeGates.shift();
    if (gate) await gate;
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
    const source = {
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      addEventListener: vi.fn(),
    };
    MockAudioContext.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }
}

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  binaryType = 'blob';
  readyState = MockWebSocket.CONNECTING;

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

  audio(bytes: number[]) {
    this.dispatchEvent(
      new MessageEvent('message', { data: new Uint8Array(bytes).buffer }),
    );
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }
}

let roots: Root[] = [];
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
  roots.push(root);
  act(() => root.render(<Listen />));
  return container;
}

async function click(element: HTMLElement | null) {
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  MockWebSocket.instances = [];
  MockAudioContext.instances = [];
  MockAudioContext.resumeGates = [];
  MockAudioContext.sources = [];
  storedValues.clear();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: localStorageMock,
  });
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('AudioContext', MockAudioContext);
});

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.replaceChildren();
  window.localStorage.clear();
  MockAudioContext.resumeGates = [];
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Listener experience', () => {
  it('starts and stops local audio while keeping translation status independent', async () => {
    const container = renderListener();
    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0];
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'off' });
    });
    expect(container).toHaveTextContent('VERBUNDEN · ÜBERSETZUNG AUS');
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();

    act(() =>
      socket.message({ type: 'translation_status', session_status: 'live' }),
    );
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeEnabled();

    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(container).toHaveTextContent('stoppen');
    expect(
      container.querySelector('button[aria-label="Stop listening"]'),
    ).toBeEnabled();

    await act(async () => {
      socket.audio([1, 0, 2, 0]);
      await Promise.resolve();
    });
    expect(MockAudioContext.sources).toHaveLength(1);
    expect(MockAudioContext.sources[0].start).toHaveBeenCalledOnce();

    await click(container.querySelector('button[aria-label="Stop listening"]'));
    expect(MockAudioContext.sources[0].stop).toHaveBeenCalledOnce();
    expect(MockAudioContext.sources[0].disconnect).toHaveBeenCalledOnce();
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeEnabled();
    await act(async () => {
      socket.audio([3, 0, 4, 0]);
      await Promise.resolve();
    });
    expect(MockAudioContext.sources).toHaveLength(1);
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );
    await act(async () => {
      socket.audio([5, 0, 6, 0]);
      await Promise.resolve();
    });
    expect(MockAudioContext.sources).toHaveLength(2);
    expect(MockAudioContext.sources[1].start).toHaveBeenCalledOnce();

    expect(container).toHaveTextContent('WARTEN AUF ÜBERSETZUNG');

    act(() => socket.message({ text: 'Guten Morgen.' }));
    expect(container).toHaveTextContent('Guten Morgen.');
    expect(container).toHaveTextContent('SESSION LIVE · DEUTSCH');
  });

  it('keeps interpreter failures distinct from a normally ended broadcast', () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({
        type: 'translation_status',
        session_status: 'error',
        last_termination_reason: 'interpreter_error',
      });
      socket.message({
        type: 'session_ended',
        reason: 'interpreter_error',
      });
    });

    expect(container).toHaveTextContent('ÜBERSETZUNG NICHT VERFÜGBAR');
    expect(container).not.toHaveTextContent('SENDUNG BEENDET');
  });

  it('drops a chunk whose audio-context resume completes after stop', async () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
    });
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );

    const context = MockAudioContext.instances[0];
    context.state = 'suspended';
    let resolveResume!: () => void;
    MockAudioContext.resumeGates.push(
      new Promise<void>((resolve) => {
        resolveResume = resolve;
      }),
      Promise.resolve(),
    );
    await act(async () => {
      socket.audio([1, 0, 2, 0]);
      await Promise.resolve();
    });

    await click(container.querySelector('button[aria-label="Stop listening"]'));
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );
    expect(
      container.querySelector('button[aria-label="Stop listening"]'),
    ).toBeEnabled();
    await act(async () => {
      resolveResume();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.querySelector('button[aria-label="Stop listening"]'),
    ).toBeEnabled();
    expect(MockAudioContext.sources).toHaveLength(0);

    MockAudioContext.resumeGates = [];
    await act(async () => {
      socket.audio([3, 0, 4, 0]);
      await Promise.resolve();
    });
    expect(MockAudioContext.sources).toHaveLength(1);
  });

  it('shows Translation OFF separately from a broadcast that has ended', async () => {
    vi.useFakeTimers();
    const container = renderListener();
    act(() => {
      MockWebSocket.instances[0].open();
    });

    act(() => {
      MockWebSocket.instances[0].message({
        type: 'translation_status',
        session_status: 'off',
      });
    });
    expect(container).toHaveTextContent('ÜBERSETZUNG AUS');

    act(() =>
      MockWebSocket.instances[0].message({
        type: 'session_ended',
        reason: 'manual',
      }),
    );
    expect(container).toHaveTextContent('SENDUNG BEENDET');

    act(() => MockWebSocket.instances[0].close());
    act(() => vi.advanceTimersByTime(1200));
    act(() => {
      MockWebSocket.instances[1].open();
      MockWebSocket.instances[1].message({
        type: 'translation_status',
        session_status: 'off',
        last_termination_reason: 'manual',
      });
    });
    expect(container).toHaveTextContent('SENDUNG BEENDET');
  });

  it('reconnects after a dropped listener socket and reports recovery', async () => {
    vi.useFakeTimers();
    const container = renderListener();
    const firstSocket = MockWebSocket.instances[0];
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();
    act(() => {
      firstSocket.open();
      firstSocket.message({
        type: 'translation_status',
        session_status: 'live',
      });
    });
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );

    act(() => firstSocket.close());
    expect(container).toHaveTextContent(
      'VERBINDUNG UNTERBROCHEN · VERBINDET ERNEUT',
    );
    expect(
      container.querySelector('button[aria-label="Stop listening"]'),
    ).toBeEnabled();
    await click(container.querySelector('button[aria-label="Stop listening"]'));
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();

    act(() => vi.advanceTimersByTime(1200));
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => MockWebSocket.instances[1].open());
    expect(
      container.querySelector('button[aria-label="Start listening"]'),
    ).toBeDisabled();
    act(() => {
      MockWebSocket.instances[1].message({
        type: 'translation_status',
        session_status: 'off',
      });
    });
    expect(container).toHaveTextContent('VERBUNDEN · ÜBERSETZUNG AUS');
  });

  it('persists theme and caption size for this listener', async () => {
    const container = renderListener();

    await click(
      container.querySelector('button[aria-label="Change to dark theme"]'),
    );
    await click(container.querySelector('button[aria-label="Larger text"]'));
    expect(container.querySelector('main')).toHaveAttribute(
      'data-theme',
      'dark',
    );

    act(() => roots[0].unmount());
    roots = [];
    document.body.replaceChildren();
    const restored = renderListener();
    expect(restored.querySelector('main')).toHaveAttribute(
      'data-theme',
      'dark',
    );
    expect(
      restored.querySelector('button[aria-label="Larger text"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
