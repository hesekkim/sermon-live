import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

class MockWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = MockWebSocket.OPEN;

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }

  message(payload: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(payload) }));
  }
}

function installStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  return values;
}

function renderApp(initialEntry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const navigateRef: { current: ((path: string) => void) | null } = { current: null };

  function NavigationController() {
    navigateRef.current = useNavigate();
    return null;
  }

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <NavigationController />
        <App />
      </MemoryRouter>
    );
  });

  return {
    container,
    root,
    navigate: (path: string) => navigateRef.current?.(path),
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  installStorage();
  window.innerWidth = 1920;
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes('/operator/settings')
        ? {
            interpreter: 'echo',
            openai_key_set: false,
            audio_device: '',
          }
        : url.includes('/audio/devices')
          ? [{ index: 0, name: 'Test input', input_channels: 1, default_sample_rate: 16000 }]
          : { running: false, listener_count: 0 };
      return { ok: true, json: async () => payload } as Response;
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Operator navigation', () => {
  it('keeps page navigation out of the sidebar and offers settings and immediate theme actions', () => {
    const { cleanup, container } = renderApp('/operator');

    const sidebar = container.querySelector('aside');
    expect(sidebar?.querySelector('a, nav')).toBeNull();
    expect(sidebar).not.toHaveTextContent('설교');
    const sidebarPowerButton = Array.from(sidebar?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.includes('방송 시작'));
    expect(sidebarPowerButton).toBeDefined();
    expect(container.querySelector('main button[aria-label="방송 시작"]')).toBeNull();
    expect(container.querySelector('a[aria-label="설정"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="다크 모드"]')).not.toBeNull();
    expect(container).toHaveTextContent('입력 (한국어)');

    act(() => {
      (container.querySelector('button[aria-label="다크 모드"]') as HTMLButtonElement).click();
    });
    expect(document.body.dataset.cmsTheme).toBe('dark');
    expect(localStorage.getItem('operatorUiTheme')).toBe('dark');

    cleanup();
  });

  it('keeps the session socket and transcript mounted across settings navigation', () => {
    const rootRender = renderApp('/operator');
    const socket = MockWebSocket.instances[0];

    expect(socket).toBeDefined();
    act(() => {
      socket?.dispatchEvent(new Event('open'));
      socket?.message({ type: 'transcript', role: 'input', text: '오늘의 설교입니다.' });
    });
    expect(rootRender.container).toHaveTextContent('오늘의 설교입니다.');

    act(() => {
      (rootRender.container.querySelector('a[aria-label="설정"]') as HTMLAnchorElement).click();
    });
    expect(rootRender.container).toHaveTextContent('설정');
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => rootRender.navigate('/operator/broadcast'));
    expect(rootRender.container).toHaveTextContent('오늘의 설교입니다.');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socket?.readyState).toBe(MockWebSocket.OPEN);

    rootRender.cleanup();

    const settingsRender = renderApp('/operator/settings');
    expect(settingsRender.container).toHaveTextContent('설정');
    settingsRender.cleanup();

    const broadcastRender = renderApp('/operator/broadcast');
    expect(broadcastRender.container).toHaveTextContent('입력 (한국어)');
    broadcastRender.cleanup();
  });
});
