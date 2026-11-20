import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Listen from '../src/pages/Listen/Listen';

const decoderMock = vi.hoisted(() => ({ instances: [] as Array<{
  decodeFrame: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  free: ReturnType<typeof vi.fn>;
}> }));

vi.mock('opus-decoder', () => ({
  OpusDecoder: class {
    ready = Promise.resolve();
    decodeFrame = vi.fn(() => ({
      channelData: [new Float32Array([0.25, -0.5])],
      samplesDecoded: 2,
      sampleRate: 24000,
      errors: [],
    }));
    reset = vi.fn(async () => undefined);
    free = vi.fn();

    constructor() {
      decoderMock.instances.push(this);
    }
  },
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

class MockAudioContext extends EventTarget {
  static instances: MockAudioContext[] = [];
  static sources: Array<{
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  state: AudioContextState = 'suspended';
  currentTime = 0;
  destination = {} as AudioDestinationNode;

  constructor() {
    super();
    MockAudioContext.instances.push(this);
  }

  async resume() {
    this.state = 'running';
    this.dispatchEvent(new Event('statechange'));
  }

  async close() {
    this.state = 'closed';
    this.dispatchEvent(new Event('statechange'));
  }

  createBuffer(_channels: number, length: number, sampleRate: number) {
    const channelData = new Float32Array(length);
    return {
      duration: length / sampleRate,
      getChannelData: () => channelData,
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
  readyState = MockWebSocket.CONNECTING;
  binaryType = 'blob';
  sent: object[] = [];

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(JSON.parse(message) as object);
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

  audio(frame: ArrayBuffer) {
    this.dispatchEvent(new MessageEvent('message', { data: frame }));
  }

  close(code = 1006, reason = '') {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(
      new CloseEvent('close', { code, reason, wasClean: code === 1000 }),
    );
  }
}

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeAudioFrame(sequence = 1): ArrayBuffer {
  const bytes = new Uint8Array(22);
  bytes.set([0x53, 0x4c, 0x31, 0x41, 1, 0]);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, 2, true);
  view.setBigUint64(8, BigInt(sequence) * 20_000n, false);
  view.setUint32(16, sequence, false);
  bytes.set([0x11, 0x22], 20);
  return bytes.buffer;
}

let roots: Root[] = [];
let containers: HTMLElement[] = [];

function renderListener() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  containers.push(container);
  act(() => root.render(<Listen />));
  return container;
}

async function submitSession(
  container: HTMLElement,
  sessionId = 'relay_session_123456',
) {
  const inputs = container.querySelectorAll('input');
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (!setValue || !inputs[0]) {
    throw new Error('Listener admission inputs were not rendered');
  }
  await act(async () => {
    setValue.call(inputs[0], sessionId);
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    container
      .querySelector('form')
      ?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubEnv(
    'VITE_RELAY_API_BASE_URL',
    'https://relay.example.test/api/v1/relay',
  );
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      response({ listener_token: 'opaque-listener-token', expires_in_seconds: 300 }),
    ),
  );
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal('AudioContext', MockAudioContext);
  vi.stubGlobal('scrollTo', vi.fn());
  MockWebSocket.instances = [];
  MockAudioContext.instances = [];
  MockAudioContext.sources = [];
  decoderMock.instances = [];
  localStorage.clear();
});

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  containers = [];
  document.body.replaceChildren();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('remote Listener', () => {
  it('authenticates over HTTPS, sends the token in the WSS hello, and decodes Opus only after explicit audio start', async () => {
    const container = renderListener();
    await submitSession(container);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://relay.example.test/api/v1/relay/sessions/relay_session_123456/listener-token',
      expect.objectContaining({ method: 'POST' }),
    );
    const socket = MockWebSocket.instances[0];
    expect(socket.url).toBe(
      'wss://relay.example.test/api/v1/relay/ws/listener/relay_session_123456',
    );
    expect(socket.url).not.toContain('opaque-listener-token');

    act(() => {
      socket.open();
      socket.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'live',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
    });
    expect(socket.sent).toContainEqual({
      type: 'listener_hello',
      session_id: 'relay_session_123456',
      listener_token: 'opaque-listener-token',
    });
    expect(container).toHaveTextContent('WARTEN AUF ÜBERSETZUNG');

    const startButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="anhören"]',
    );
    await act(async () => {
      startButton?.click();
      await Promise.resolve();
    });
    expect(socket.sent).toContainEqual({ type: 'audio', enabled: true });

    act(() => {
      socket.message({
        type: 'subtitle',
        session_id: 'relay_session_123456',
        sequence: 1,
        timestamp_ms: 20,
        language: 'de',
        text: 'Guten Morgen',
      });
      socket.audio(makeAudioFrame());
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container).toHaveTextContent('Guten Morgen');
    expect(decoderMock.instances[0]?.decodeFrame).toHaveBeenCalledOnce();
    expect(MockAudioContext.sources).toHaveLength(1);
    act(() => socket.audio(makeAudioFrame(3)));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(decoderMock.instances[0]?.reset).toHaveBeenCalledOnce();
    expect(decoderMock.instances[0]?.decodeFrame).toHaveBeenCalledTimes(2);
    expect(MockAudioContext.sources[0]?.stop).not.toHaveBeenCalled();
    expect(MockAudioContext.sources).toHaveLength(2);
    expect(localStorage.getItem('sermon-listener-preferences')).not.toContain(
      'opaque-listener-token',
    );
  });

  it('shows audio frame errors in the recovery message area', async () => {
    const container = renderListener();
    await submitSession(container);
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'live',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="anhören"]')
        ?.click();
      await Promise.resolve();
    });

    act(() => socket.audio(new ArrayBuffer(4)));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container).toHaveTextContent('Audio frame is truncated');
  });

  it('shows a generic session error when admission is denied', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 401)));
    const container = renderListener();

    await submitSession(container, 'relay_session_123456');

    expect(container).toHaveTextContent(
      'The session code is invalid.',
    );
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('does not admit a session while the broadcast is not live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 409)));
    const container = renderListener();

    await submitSession(container);

    expect(container).toHaveTextContent(
      'The broadcast is not live right now. Please try again later.',
    );
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('prefills the session code and explains that the shared link grants access', () => {
    vi.stubGlobal('location', {
      href: 'https://listener.example/listen?session=relay_session_123456',
      search: '?session=relay_session_123456',
    });
    const container = renderListener();

    expect(container.querySelectorAll('input')[0]).toHaveValue(
      'relay_session_123456',
    );
    expect(container).toHaveTextContent(
      'Anyone with the shared link can listen. Share it only with your intended audience.',
    );
  });

  it('shows the end dialog and returns to admission after five seconds', async () => {
    vi.useFakeTimers();
    const container = renderListener();
    await submitSession(container);
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'live',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
      socket.message({
        type: 'status',
        status: 'ended',
        reason: 'publisher_closed',
      });
      socket.message({
        type: 'subtitle',
        session_id: 'relay_session_123456',
        sequence: 2,
        timestamp_ms: 40,
        language: 'de',
        text: 'This must not appear after sign-out.',
      });
    });

    expect(container.querySelector('[role="alertdialog"]')).toHaveTextContent(
      '5 Sekunden',
    );
    expect(container).not.toHaveTextContent(
      'This must not appear after sign-out.',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(container.querySelector('[role="alertdialog"]')).toHaveTextContent(
      '4 Sekunden',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(container.querySelector('[role="alertdialog"]')).toHaveTextContent(
      '3 Sekunden',
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(1);
    expect(container.querySelectorAll('input')[0]).toHaveValue(
      'relay_session_123456',
    );
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('requires reconnecting with the shared session link when the token expires', async () => {
    const container = renderListener();
    await submitSession(container);
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'live',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
      socket.close(1008, 'Listener token expired');
    });

    expect(container).toHaveTextContent(
      'Your Listener access expired. Reconnect using the shared link.',
    );
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('reconnects to Berlin with exponential retry after a network close', async () => {
    vi.useFakeTimers();
    const container = renderListener();
    await submitSession(container);
    const firstSocket = MockWebSocket.instances[0];
    act(() => {
      firstSocket.open();
      firstSocket.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'live',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
      firstSocket.close(1006, 'Network lost');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.url).toContain(
      '/ws/listener/relay_session_123456',
    );
    expect(container).toHaveTextContent(/retrying|erneut/i);
    act(() => {
      MockWebSocket.instances[1]?.open();
      MockWebSocket.instances[1]?.message({
        type: 'listener_ready',
        protocol: 'sermon-live/1',
        session_id: 'relay_session_123456',
        status: 'reconnecting',
        codec: 'opus',
        sample_rate: 24000,
        channels: 1,
        packet_duration_ms: 20,
      });
    });
    expect(container.querySelector('form')).toBeNull();
    expect(container).toHaveTextContent(/TRANSLATION RECONNECTING|ÜBERSETZUNG WIRD/);
  });

  it('recreates AudioContext after returning from a hidden mobile page', async () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(
      document,
      'visibilityState',
    );
    try {
      const container = renderListener();
      await submitSession(container);
      const socket = MockWebSocket.instances[0];
      act(() => {
        socket.open();
        socket.message({
          type: 'listener_ready',
          protocol: 'sermon-live/1',
          session_id: 'relay_session_123456',
          status: 'live',
          codec: 'opus',
          sample_rate: 24000,
          channels: 1,
          packet_duration_ms: 20,
        });
      });
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('button[aria-label="anhören"]')
          ?.click();
        await Promise.resolve();
      });

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      act(() => document.dispatchEvent(new Event('visibilitychange')));
      expect(container).toHaveTextContent('Audio fortsetzen');

      await act(async () => {
        container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Audio fortsetzen"]',
          )
          ?.click();
        await Promise.resolve();
      });

      expect(MockAudioContext.instances).toHaveLength(2);
      expect(MockAudioContext.instances[0]?.state).toBe('closed');
      expect(MockAudioContext.instances[1]?.state).toBe('running');
      expect(socket.sent).toContainEqual({ type: 'audio', enabled: true });
    } finally {
      if (originalVisibility) {
        Object.defineProperty(document, 'visibilityState', originalVisibility);
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
    }
  });
});
