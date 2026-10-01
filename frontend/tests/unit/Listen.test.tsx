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
  vi.stubGlobal('scrollTo', vi.fn());
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
  it('scrolls the document to its bottom as subtitle text arrives', () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({ text: 'Guten ' });
    });

    const scrollTo = vi.fn();
    const originalScrollTo = Object.getOwnPropertyDescriptor(window, 'scrollTo');
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      document.documentElement,
      'scrollHeight',
    );
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 1600,
    });
    try {
      act(() => socket.message({ text: 'Morgen' }));

      expect(scrollTo).toHaveBeenLastCalledWith(0, 1600);
      expect(container).toHaveTextContent('Guten Morgen');
    } finally {
      if (originalScrollTo) {
        Object.defineProperty(window, 'scrollTo', originalScrollTo);
      } else {
        delete (window as Partial<Window>).scrollTo;
      }
      if (originalScrollHeight) {
        Object.defineProperty(
          document.documentElement,
          'scrollHeight',
          originalScrollHeight,
        );
      } else {
        Reflect.deleteProperty(document.documentElement, 'scrollHeight');
      }
    }
  });

  it('keeps the screen awake while listening and releases the lock on stop', async () => {
    const originalWakeLock = Object.getOwnPropertyDescriptor(
      navigator,
      'wakeLock',
    );
    const release = vi.fn(async () => undefined);
    const wakeLock = {
      released: false,
      release,
      addEventListener: vi.fn(),
    };
    const request = vi.fn(async () => wakeLock);
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    try {
      const container = renderListener();
      const socket = MockWebSocket.instances[0];
      act(() => {
        socket.open();
        socket.message({ type: 'translation_status', session_status: 'live' });
      });
      await click(
        container.querySelector('button[aria-label="Start listening"]'),
      );
      await act(async () => {
        await Promise.resolve();
      });

      expect(request).toHaveBeenCalledWith('screen');

      await click(container.querySelector('button[aria-label="Stop listening"]'));
      expect(release).toHaveBeenCalledOnce();
    } finally {
      if (originalWakeLock) {
        Object.defineProperty(navigator, 'wakeLock', originalWakeLock);
      } else {
        Reflect.deleteProperty(navigator, 'wakeLock');
      }
    }
  });

  it('does not render a scripture card before receiving a scripture event', () => {
    const container = renderListener();

    expect(container.querySelector('h1')).toHaveTextContent('Seanuree Live');

    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toBeNull();
  });

  it('tracks a left swipe and closes after the exit animation', () => {
    vi.useFakeTimers();
    const container = renderListener();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({
        type: 'scripture',
        reference: 'Epheser 1,2',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 2, text: 'Canonical passage text.' }],
      });
    });
    expect(container).toHaveTextContent('Zum Schließen nach links wischen');

    const popup = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    const pointerEvent = (type: string, clientX: number, clientY: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX,
        clientY,
      });
      return event;
    };

    act(() => popup?.dispatchEvent(pointerEvent('pointerdown', 350, 40)));
    act(() => {
      popup?.dispatchEvent(pointerEvent('pointermove', 250, 42));
    });
    expect(popup).toHaveClass(/scriptureDimmed/);
    expect(popup?.getAttribute('style')).toContain('-100px');

    act(() => popup?.dispatchEvent(pointerEvent('pointerup', 100, 42)));
    expect(popup).toHaveClass(/scriptureSwipingOut/);
    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).not.toBeNull();
    act(() => vi.advanceTimersByTime(260));
    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toBeNull();
  });

  it('reveals the next received scripture when the top card is swiped away', () => {
    vi.useFakeTimers();
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
    });
    act(() => {
      socket.message({
        type: 'scripture',
        reference: 'Römer 3,28',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 28, text: 'First passage.' }],
      });
    });
    act(() => {
      socket.message({
        type: 'scripture',
        reference: 'Epheser 1,2',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 2, text: 'Second passage.' }],
      });
    });

    const topCard = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    expect(topCard).toHaveTextContent('Second passage.');
    expect(
      container.querySelectorAll('aside[aria-hidden="true"]'),
    ).toHaveLength(1);
    const pointerEvent = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX,
        clientY: 40,
      });
      return event;
    };
    act(() => topCard?.dispatchEvent(pointerEvent('pointerdown', 350)));
    act(() => topCard?.dispatchEvent(pointerEvent('pointerup', 100)));
    act(() => vi.advanceTimersByTime(260));

    const revealedCard = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    expect(revealedCard).toHaveTextContent('First passage.');
    expect(container).toHaveTextContent('Zum Schließen nach links wischen');
  });

  it('shows a new scripture popup after the last card is swiped away', () => {
    vi.useFakeTimers();
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({
        type: 'scripture',
        reference: 'Römer 3,28',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 28, text: 'First passage.' }],
      });
    });

    const firstCard = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    const pointerEvent = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX,
        clientY: 40,
      });
      return event;
    };
    act(() => firstCard?.dispatchEvent(pointerEvent('pointerdown', 350)));
    act(() => firstCard?.dispatchEvent(pointerEvent('pointerup', 100)));
    act(() => vi.advanceTimersByTime(260));
    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toBeNull();

    act(() => {
      socket.message({
        type: 'scripture',
        reference: 'Epheser 1,2',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 2, text: 'Next passage.' }],
      });
    });

    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toHaveTextContent('Next passage.');
    expect(container).toHaveTextContent('Zum Schließen nach links wischen');
  });

  it('keeps a new scripture when it arrives during the dismiss animation', () => {
    vi.useFakeTimers();
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({
        type: 'scripture',
        reference: 'Römer 3,28',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 28, text: 'First passage.' }],
      });
    });

    const firstCard = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    const pointerEvent = (type: string, clientX: number) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: 'touch',
        button: 0,
        clientX,
        clientY: 40,
      });
      return event;
    };
    act(() => firstCard?.dispatchEvent(pointerEvent('pointerdown', 350)));
    act(() => firstCard?.dispatchEvent(pointerEvent('pointerup', 100)));

    act(() => {
      socket.message({
        type: 'scripture',
        reference: 'Epheser 1,2',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 2, text: 'Next passage.' }],
      });
    });
    act(() => vi.advanceTimersByTime(260));

    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toHaveTextContent('Next passage.');
    expect(container).toHaveTextContent('Zum Schließen nach links wischen');
  });

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

    act(() => {
      socket.message({ text: 'Guten ' });
      socket.message({ text: 'Morgen.' });
    });
    expect(container).toHaveTextContent('Guten Morgen.');
    expect(container).toHaveTextContent('SESSION LIVE · DEUTSCH');

    act(() => {
      socket.message({ text: 'Wie ' });
      socket.message({ text: 'geht es?' });
    });
    expect(container).toHaveTextContent('Wie geht es?');
    expect(container).toHaveTextContent('Guten Morgen.');

    act(() => {
      socket.message({ text: 'Guten Morgen.' });
      socket.message({ text: '”' });
    });
    expect(container).toHaveTextContent('Guten Morgen.”');

    act(() => {
      socket.message({ text: 'Nächste Sendung' });
    });
    expect(container).toHaveTextContent('Nächste Sendung');
    expect(container).toHaveTextContent('Guten Morgen.');

    act(() =>
      socket.message({
        type: 'translation_status',
        session_status: 'starting',
      }),
    );
    expect(container).not.toHaveTextContent('Guten Morgen.');
    act(() => {
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({ text: 'Neue ' });
      socket.message({ text: 'Sendung.' });
    });
    expect(container).toHaveTextContent('Neue Sendung.');
    expect(container).not.toHaveTextContent('Guten Morgen.');
  });

  it('shows a canonical passage below the translation without replacing it', async () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({ text: 'OpenAI translation remains visible.' });
      socket.message({
        type: 'scripture',
        reference: 'Römer 3,28',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 28, text: 'Canonical passage text.' }],
      });
    });

    const transcript = container.querySelector(
      '[aria-label="German translation"]',
    );
    const scripture = container.querySelector(
      '[aria-label^="Bibeltext abdunkeln"]',
    );
    expect(transcript).toHaveTextContent('OpenAI translation remains visible.');
    expect(scripture).toHaveTextContent('Römer 3,28');
    expect(scripture).toHaveTextContent('Canonical passage text.');
    expect(scripture).toHaveAttribute('role', 'button');

    const pressEvent = (type: string) => {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 240,
        clientY: 80,
      });
      return event;
    };
    act(() => scripture?.dispatchEvent(pressEvent('pointerdown')));
    expect(scripture).toHaveClass(/scriptureDimmed/);
    act(() => scripture?.dispatchEvent(pressEvent('pointerup')));
    expect(scripture).not.toHaveClass(/scriptureDimmed/);

    act(() => {
      socket.message({
        type: 'scripture',
        reference: 'Epheser 1,2',
        version: 'Lutherbibel 1912',
        verses: [{ verse: 2, text: 'Next canonical passage.' }],
      });
    });
    expect(container).toHaveTextContent('Canonical passage text.');
    expect(container).toHaveTextContent('Next canonical passage.');
    expect(
      container.querySelectorAll('aside[aria-hidden="true"]'),
    ).toHaveLength(1);
    const currentScripture = container.querySelector(
      '[aria-label="Bibeltext abdunkeln; nach links wischen zum Schließen"]',
    );
    expect(currentScripture).not.toHaveClass(/scriptureDimmed/);

    act(() => {
      currentScripture?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toBeNull();

    act(() =>
      socket.message({
        type: 'translation_status',
        session_status: 'starting',
      }),
    );
    expect(
      container.querySelector('[aria-label^="Bibeltext abdunkeln"]'),
    ).toBeNull();
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

  it('drops scheduled audio backlog and keeps the newest chunk', async () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
    });
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );
    const chunk = new Uint8Array(24000 * 2 * 2).buffer;

    await act(async () => {
      for (let index = 0; index < 3; index += 1) {
        socket.dispatchEvent(new MessageEvent('message', { data: chunk }));
        await Promise.resolve();
      }
      await Promise.resolve();
    });

    expect(MockAudioContext.sources).toHaveLength(3);
    expect(MockAudioContext.sources[0].stop).toHaveBeenCalledOnce();
    expect(MockAudioContext.sources[1].stop).toHaveBeenCalledOnce();
    expect(MockAudioContext.sources[2].stop).not.toHaveBeenCalled();
    expect(MockAudioContext.sources[2].start).toHaveBeenCalledWith(0.05);
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
    expect(container).not.toHaveTextContent('SENDUNG BEENDET');
    expect(
      container.querySelector('button[aria-label="Sendung beendet"]'),
    ).toBeDisabled();

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
    expect(container).not.toHaveTextContent('SENDUNG BEENDET');
    expect(
      container.querySelector('button[aria-label="Sendung beendet"]'),
    ).toBeDisabled();
  });

  it('preserves transcript and stops audio when the broadcast ends', async () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({ text: 'First sentence.' });
      socket.message({ text: 'Second sentence.' });
    });
    await click(
      container.querySelector('button[aria-label="Start listening"]'),
    );
    await act(async () => {
      socket.audio([1, 0, 2, 0]);
      await Promise.resolve();
    });

    act(() => socket.message({ type: 'session_ended', reason: 'manual' }));

    expect(container).toHaveTextContent('First sentence.');
    expect(container).toHaveTextContent('Second sentence.');
    expect(MockAudioContext.sources[0].stop).toHaveBeenCalledOnce();
    expect(
      container.querySelector('button[aria-label="Sendung beendet"]'),
    ).toBeDisabled();
  });

  it('keeps German abbreviations together in listener captions', () => {
    const container = renderListener();
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
      socket.message({ type: 'translation_status', session_status: 'live' });
      socket.message({ text: 'Das ist z. B. laut d. h. einer Quelle der 1. Mose.' });
      socket.message({ text: ' Danach kommt ein neuer Satz.' });
    });

    const transcript = container.querySelector(
      '[aria-label="German translation"]',
    );
    expect(transcript?.querySelectorAll('p')).toHaveLength(2);
    expect(transcript).toHaveTextContent(
      'Das ist z. B. laut d. h. einer Quelle der 1. Mose.',
    );
    expect(transcript).toHaveTextContent('Danach kommt ein neuer Satz.');
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
