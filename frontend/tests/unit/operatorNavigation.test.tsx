import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import { operatorFetch } from '../../src/pages/Operator/auth/operatorAuthApi';
import { buildListenQrUrl } from '../../src/pages/Operator/layout/listenQrUrl';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(payload) }),
    );
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

async function renderApp(initialEntry: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const navigateRef: { current: ((path: string) => void) | null } = {
    current: null,
  };

  function NavigationController() {
    navigateRef.current = useNavigate();
    return null;
  }

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <NavigationController />
        <App />
      </MemoryRouter>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
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

let isAuthenticated = true;
let authUnavailable = false;
let loginInvalid = false;
let logoutUnavailable = false;
let logoutForbidden = false;
let protectedApiForbidden = false;
let detectedLanIp: string | null = '192.168.1.12';

beforeEach(() => {
  installStorage();
  window.innerWidth = 1920;
  MockWebSocket.instances = [];
  isAuthenticated = true;
  authUnavailable = false;
  loginInvalid = false;
  logoutUnavailable = false;
  logoutForbidden = false;
  protectedApiForbidden = false;
  detectedLanIp = '192.168.1.12';
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      let payload: unknown;
      if (url.includes('/auth/session')) {
        if (authUnavailable) {
          return { ok: false, status: 503, json: async () => ({}) } as Response;
        }
        payload = {
          authenticated: isAuthenticated,
          csrf_token: 'test-csrf-token',
        };
      } else if (url.includes('/auth/login')) {
        if (loginInvalid) {
          return { ok: false, status: 401, json: async () => ({}) } as Response;
        }
        isAuthenticated = true;
        payload = { authenticated: true, csrf_token: 'test-csrf-token' };
      } else if (url.includes('/auth/logout')) {
        if (logoutUnavailable) throw new TypeError('Network request failed');
        if (logoutForbidden) {
          return { ok: false, status: 403, json: async () => ({}) } as Response;
        }
        isAuthenticated = false;
        payload = { authenticated: false };
      } else if (url.includes('/operator/settings')) {
        payload = {
          interpreter: 'echo',
          openai_key_set: false,
          audio_device: '',
        };
      } else if (url.includes('/operator/network')) {
        payload = { lan_ip: detectedLanIp };
      } else if (url.includes('/api/v1/session') && protectedApiForbidden) {
        return { ok: false, status: 403, json: async () => ({}) } as Response;
      } else if (url.includes('/audio/devices')) {
        payload = [
          {
            index: 0,
            name: 'Test input',
            input_channels: 1,
            default_sample_rate: 16000,
          },
        ];
      } else {
        payload = { running: false, listener_count: 0 };
      }
      return {
        ok: true,
        status: 200,
        json: async () => payload,
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Operator navigation', () => {
  it('shows a scannable Listen QR and lets the operator copy or refresh its URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const page = await renderApp('/operator');

    await act(async () => {
      (
        page.container.querySelector(
          'button[aria-label="청취 QR"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    let dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    const firstUrl = buildListenQrUrl(window.location.origin, detectedLanIp);
    expect((dialog.querySelector('input') as HTMLInputElement).value).toBe(
      firstUrl,
    );
    expect(dialog.querySelector('svg')).not.toBeNull();

    const copyButton = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('주소 복사'),
    );
    await act(async () => {
      copyButton?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(firstUrl);
    expect(dialog).toHaveTextContent('주소를 복사했습니다');

    detectedLanIp = '192.168.1.13';
    const refreshButton = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('다시 확인'),
    );
    await act(async () => {
      refreshButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect((dialog.querySelector('input') as HTMLInputElement).value).toBe(
      buildListenQrUrl(window.location.origin, detectedLanIp),
    );

    page.cleanup();
  });

  it('keeps page navigation out of the sidebar and offers settings and immediate theme actions', async () => {
    const { cleanup, container } = await renderApp('/operator');

    const sidebar = container.querySelector('aside');
    expect(sidebar?.querySelector('a, nav')).toBeNull();
    expect(sidebar).not.toHaveTextContent('설교');
    const sidebarPowerButton = Array.from(
      sidebar?.querySelectorAll('button') ?? [],
    ).find((button) => button.textContent?.includes('방송 시작'));
    expect(sidebarPowerButton).toBeDefined();
    expect(
      container.querySelector('main button[aria-label="방송 시작"]'),
    ).toBeNull();
    expect(container.querySelector('a[aria-label="설정"]')).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="다크 모드"]'),
    ).not.toBeNull();
    expect(container).toHaveTextContent('입력 (한국어)');

    act(() => {
      (
        container.querySelector(
          'button[aria-label="다크 모드"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(document.body.dataset.cmsTheme).toBe('dark');
    expect(localStorage.getItem('operatorUiTheme')).toBe('dark');

    cleanup();
  });

  it('redirects the disabled sermon session route to Broadcast', async () => {
    const page = await renderApp('/operator/sermon-session');

    expect(page.container).toHaveTextContent('입력 (한국어)');
    expect(page.container).not.toHaveTextContent('설교 제목');
    expect(page.container.querySelector('a[aria-label="설정"]')).not.toBeNull();

    page.cleanup();
  });

  it('keeps the session socket and transcript mounted across settings navigation', async () => {
    const rootRender = await renderApp('/operator');
    const socket = MockWebSocket.instances[0];

    expect(socket).toBeDefined();
    act(() => {
      socket?.dispatchEvent(new Event('open'));
      socket?.message({
        type: 'transcript',
        role: 'input',
        text: '오늘의 설교입니다.',
      });
    });
    expect(rootRender.container).toHaveTextContent('오늘의 설교입니다.');

    act(() => {
      (
        rootRender.container.querySelector(
          'a[aria-label="설정"]',
        ) as HTMLAnchorElement
      ).click();
    });
    expect(rootRender.container).toHaveTextContent('설정');
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => rootRender.navigate('/operator/broadcast'));
    expect(rootRender.container).toHaveTextContent('오늘의 설교입니다.');
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socket?.readyState).toBe(MockWebSocket.OPEN);

    rootRender.cleanup();

    const settingsRender = await renderApp('/operator/settings');
    expect(settingsRender.container).toHaveTextContent('설정');
    settingsRender.cleanup();

    const broadcastRender = await renderApp('/operator/broadcast');
    expect(broadcastRender.container).toHaveTextContent('입력 (한국어)');
    broadcastRender.cleanup();
  });

  it('gates Operator routes until login and returns to the requested route after logout', async () => {
    isAuthenticated = false;
    const page = await renderApp('/operator/settings');

    expect(page.container).toHaveTextContent('Operator 로그인');
    expect(page.container).not.toHaveTextContent('API 모델');

    const password = page.container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      valueSetter?.call(password, 'not-saved-password');
      password.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const submitButton = Array.from(
      page.container.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('로그인'),
    ) as HTMLButtonElement;
    await act(async () => {
      submitButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(page.container).toHaveTextContent('API 모델');
    expect(page.container.querySelector('input[type="password"]')).toBeNull();

    await act(async () => {
      (
        page.container.querySelector(
          'button[aria-label="로그아웃"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(page.container).toHaveTextContent('Operator 로그인');
    page.cleanup();
  });

  it('shows invalid password feedback inside the password InputField', async () => {
    isAuthenticated = false;
    loginInvalid = true;
    const page = await renderApp('/operator');
    const password = page.container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      valueSetter?.call(password, 'incorrect-password');
      password.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const submitButton = Array.from(
      page.container.querySelectorAll('button'),
    ).find((button) =>
      button.textContent?.includes('로그인'),
    ) as HTMLButtonElement;

    await act(async () => {
      submitButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      page.container.querySelector('input[type="password"]'),
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      page.container.querySelector('.input-field__error-message'),
    ).toHaveTextContent('비밀번호가 올바르지 않습니다');
    page.cleanup();
  });

  it('shows only a session retry action while authentication is unavailable', async () => {
    authUnavailable = true;
    const page = await renderApp('/operator');

    expect(page.container).toHaveTextContent('인증 서버에 연결할 수 없습니다');
    expect(page.container.querySelector('input[type="password"]')).toBeNull();
    expect(page.container.querySelector('button')).toHaveTextContent(
      '다시 시도',
    );
    const buttonLabels = Array.from(
      page.container.querySelectorAll('button'),
    ).map((button) => button.textContent?.trim());
    expect(buttonLabels).not.toContain('로그인');

    page.cleanup();
  });

  it('returns to the login gate when a protected request is forbidden', async () => {
    const page = await renderApp('/operator');
    protectedApiForbidden = true;

    await act(async () => {
      await operatorFetch('/api/v1/session');
      await Promise.resolve();
    });

    expect(page.container).toHaveTextContent('Operator 로그인');
    expect(page.container).not.toHaveTextContent('API 모델');
    page.cleanup();
  });

  it('keeps the operator page open and reports logout network failures', async () => {
    const page = await renderApp('/operator');
    logoutUnavailable = true;

    await act(async () => {
      (
        page.container.querySelector(
          'button[aria-label="로그아웃"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body).toHaveTextContent(
      '로그아웃에 실패했습니다. 연결을 확인하고 다시 시도하세요.',
    );
    expect(page.container).toHaveTextContent('입력 (한국어)');
    expect(page.container).not.toHaveTextContent('Operator 로그인');
    page.cleanup();
  });

  it('keeps the operator page open when the server rejects logout', async () => {
    const page = await renderApp('/operator');
    logoutForbidden = true;

    await act(async () => {
      (
        page.container.querySelector(
          'button[aria-label="로그아웃"]',
        ) as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body).toHaveTextContent(
      '로그아웃에 실패했습니다. 연결을 확인하고 다시 시도하세요.',
    );
    expect(page.container).toHaveTextContent('입력 (한국어)');
    expect(page.container).not.toHaveTextContent('Operator 로그인');
    page.cleanup();
  });
});
