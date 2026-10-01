import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';
import { operatorCopy } from '../../src/pages/Operator/translations';
import { useBroadcastToggle } from '../../src/pages/Operator/broadcast/hooks/useBroadcastToggle';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeProps {
  sessionStatus: 'off' | 'live';
  start?: () => Promise<void>;
  beforeStart?: () => Promise<boolean>;
  clearTranscripts?: () => void;
  stop: () => Promise<void>;
  extend: () => Promise<unknown>;
}

function Probe({
  sessionStatus,
  start = async () => undefined,
  beforeStart,
  clearTranscripts,
  stop,
  extend,
}: ProbeProps) {
  const sessionErrorDuringAttemptRef = useRef(false);
  const { actionPending, toggleSession, stopNow, extendSession } =
    useBroadcastToggle({
      labels: operatorCopy.ko,
      sessionStatus,
      start,
      beforeStart,
      clearTranscripts,
      stop,
      extend,
      sessionErrorDuringAttemptRef,
    });

  return (
    <>
      <button type="button" onClick={() => void toggleSession()}>
        Toggle
      </button>
      <button
        type="button"
        disabled={actionPending}
        onClick={() => void extendSession()}
      >
        Extend
      </button>
      <button
        type="button"
        disabled={actionPending}
        onClick={() => void stopNow()}
      >
        Stop now
      </button>
    </>
  );
}

function renderProbe(props: ProbeProps) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ToastProvider>
        <Probe {...props} />
      </ToastProvider>,
    );
  });
  return { container, root };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useBroadcastToggle timer actions', () => {
  it('reports extension errors and prevents duplicate requests while pending', async () => {
    let rejectExtension: (reason: Error) => void = () => undefined;
    const extend = vi.fn(
      () =>
        new Promise<unknown>((_resolve, reject) => {
          rejectExtension = reject;
        }),
    );
    const { container, root } = renderProbe({
      sessionStatus: 'live',
      stop: vi.fn(),
      extend,
    });
    const extendButton =
      container.querySelectorAll<HTMLButtonElement>('button')[1];

    await act(async () => {
      extendButton?.click();
      extendButton?.click();
      await Promise.resolve();
    });

    expect(extend).toHaveBeenCalledTimes(1);
    expect(extendButton).toBeDisabled();

    await act(async () => {
      rejectExtension(new Error('extension failed'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('[role="alert"]')).toHaveTextContent(
      operatorCopy.ko.extendFailed,
    );
    expect(extendButton).not.toBeDisabled();
    act(() => root.unmount());
  });

  it('reports stop-now errors', async () => {
    const stop = vi.fn().mockRejectedValue(new Error('stop failed'));
    const { container, root } = renderProbe({
      sessionStatus: 'live',
      stop,
      extend: vi.fn(),
    });
    const stopButton =
      container.querySelectorAll<HTMLButtonElement>('button')[2];

    await act(async () => {
      stopButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.querySelector('[role="alert"]')).toHaveTextContent(
      operatorCopy.ko.stopFailed,
    );
    act(() => root.unmount());
  });

  it('starts after the session has ended', async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn();
    const { container, root } = renderProbe({
      sessionStatus: 'off',
      start,
      stop,
      extend: vi.fn(),
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
      await Promise.resolve();
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('clears transcripts after start approval and before starting', async () => {
    const calls: string[] = [];
    const beforeStart = vi.fn().mockResolvedValue(true);
    const clearTranscripts = vi.fn(() => calls.push('clear'));
    const start = vi.fn(async () => {
      calls.push('start');
    });
    const { container, root } = renderProbe({
      sessionStatus: 'off',
      beforeStart,
      clearTranscripts,
      start,
      stop: vi.fn(),
      extend: vi.fn(),
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
      await Promise.resolve();
    });

    expect(beforeStart).toHaveBeenCalledOnce();
    expect(calls).toEqual(['clear', 'start']);
    act(() => root.unmount());
  });

  it('preserves transcripts and does not start when start is cancelled', async () => {
    const beforeStart = vi.fn().mockResolvedValue(false);
    const clearTranscripts = vi.fn();
    const start = vi.fn();
    const { container, root } = renderProbe({
      sessionStatus: 'off',
      beforeStart,
      clearTranscripts,
      start,
      stop: vi.fn(),
      extend: vi.fn(),
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
      await Promise.resolve();
    });

    expect(start).not.toHaveBeenCalled();
    expect(clearTranscripts).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
