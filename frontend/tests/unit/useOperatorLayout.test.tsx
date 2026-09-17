import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useOperatorLayout,
} from '../../src/pages/Operator/layout/useOperatorLayout';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

interface LayoutState {
  isSidebarCollapsed: boolean;
  showInputPane: boolean;
  toggleSidebarCollapsed: () => void;
}

function Probe({ onRender }: { onRender: (state: LayoutState) => void }) {
  onRender(useOperatorLayout());
  return null;
}

function renderProbe(onRender: (state: LayoutState) => void) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<Probe onRender={onRender} />);
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
}

beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
  });
  window.innerWidth = 1280;
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('useOperatorLayout', () => {
  it('hides the input pane and collapses the sidebar below the dual-pane width', () => {
    let state!: LayoutState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    expect(state.showInputPane).toBe(false);
    expect(state.isSidebarCollapsed).toBe(true);

    cleanup();
  });

  it('restores the user collapse preference when the viewport supports two panes', () => {
    let state!: LayoutState;
    const cleanup = renderProbe((nextState) => {
      state = nextState;
    });

    act(() => {
      window.innerWidth = 1920;
      window.dispatchEvent(new Event('resize'));
    });
    expect(state.showInputPane).toBe(true);
    expect(state.isSidebarCollapsed).toBe(false);

    act(() => state.toggleSidebarCollapsed());
    expect(state.isSidebarCollapsed).toBe(true);
    expect(localStorage.getItem('operatorSidebarCollapsed')).toBe('true');

    cleanup();
  });
});