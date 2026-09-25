import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';

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

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    );
  });

  return {
    container,
    root,
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
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('Operator navigation', () => {
  it('shows the three top-level operator areas and marks the active route', () => {
    const { cleanup, container } = renderApp('/operator/settings');

    expect(container.querySelector('button[aria-label="방송"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="설교"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="설정"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="설정"]')?.className).toContain('active');

    cleanup();
  });

  it('redirects the operator root and supports direct deep links', () => {
    const rootRender = renderApp('/operator');
    const rootButton = rootRender.container.querySelector('button[aria-label="방송"]') as HTMLButtonElement;

    expect(rootButton.className).toContain('active');

    rootRender.cleanup();

    const deepLinkRender = renderApp('/operator/sermon-session');
    const sermonButton = deepLinkRender.container.querySelector('button[aria-label="설교"]') as HTMLButtonElement;
    expect(sermonButton.className).toContain('active');

    deepLinkRender.cleanup();
  });
});
