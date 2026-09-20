import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from '../../src/shared/components/Toast/ToastProvider';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const toast = useToast();

  return (
    <div>
      <button type="button" onClick={() => toast.info('Info')}>
        info
      </button>
      <button type="button" onClick={() => toast.warning('Warning')}>
        warning
      </button>
      <button type="button" onClick={() => toast.error('Error')}>
        error
      </button>
    </div>
  );
}

function renderToastProvider(closeLabel = 'Close', durationMs?: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ToastProvider closeLabel={closeLabel} durationMs={durationMs}>
        <Probe />
      </ToastProvider>
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('ToastProvider', () => {
  it('exposes toast variants and keeps the localized close label', () => {
    const { container, cleanup } = renderToastProvider('닫기');

    act(() => {
      container.querySelector<HTMLButtonElement>('button')?.click();
      container.querySelectorAll<HTMLButtonElement>('button')[1]?.click();
      container.querySelectorAll<HTMLButtonElement>('button')[2]?.click();
    });

    const viewport = document.body.querySelector('.cms-theme');
    expect(viewport).toHaveClass('cms-theme');
    expect(viewport?.querySelectorAll('[role="status"]')).toHaveLength(2);
    expect(viewport?.querySelector('[role="alert"]')).toBeInTheDocument();
    expect(viewport?.querySelectorAll('button[aria-label="닫기"]')).toHaveLength(3);
    expect(viewport?.querySelectorAll('[aria-atomic="true"]')).toHaveLength(3);

    cleanup();
  });

  it('dismisses a toast manually and automatically', () => {
    const { container, cleanup } = renderToastProvider('Close', 1000);

    act(() => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      'button[aria-label="Close"]'
    );
    expect(closeButton).toBeInTheDocument();

    act(() => closeButton?.click());
    expect(document.body.querySelector('[role="status"]')).not.toBeInTheDocument();

    act(() => {
      container.querySelector<HTMLButtonElement>('button')?.click();
      vi.advanceTimersByTime(1000);
    });
    expect(document.body.querySelector('[role="status"]')).not.toBeInTheDocument();

    cleanup();
  });
});