import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../src/shared/components/Toast/ToastProvider';
import { operatorCopy } from '../../src/pages/Operator/translations';
import { useBroadcastToggle } from '../../src/pages/Operator/broadcast/hooks/useBroadcastToggle';

(globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
}).IS_REACT_ACT_ENVIRONMENT = true;

interface ProbeProps {
  stop: () => Promise<void>;
  extend: () => Promise<unknown>;
}

function Probe({ stop, extend }: ProbeProps) {
  const sessionErrorDuringAttemptRef = useRef(false);
  const { actionPending, stopNow, extendSession } = useBroadcastToggle({
    labels: operatorCopy.ko,
    running: true,
    start: async () => undefined,
    stop,
    extend,
    sessionErrorDuringAttemptRef,
  });

  return (
    <>
      <button type="button" disabled={actionPending} onClick={() => void extendSession()}>
        Extend
      </button>
      <button type="button" disabled={actionPending} onClick={() => void stopNow()}>
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
    const extend = vi.fn(() => new Promise<unknown>((_resolve, reject) => {
      rejectExtension = reject;
    }));
    const { container, root } = renderProbe({ stop: vi.fn(), extend });
    const extendButton = container.querySelector<HTMLButtonElement>('button');

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
    const { container, root } = renderProbe({ stop, extend: vi.fn() });
    const stopButton = container.querySelectorAll<HTMLButtonElement>('button')[1];

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
});