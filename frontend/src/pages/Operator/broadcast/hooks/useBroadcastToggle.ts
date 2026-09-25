import { useRef, useState, type MutableRefObject } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy } from '../../translations';

interface UseBroadcastToggleOptions {
  labels: OperatorCopy;
  running: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sessionErrorDuringAttemptRef: MutableRefObject<boolean>;
}

export function useBroadcastToggle({
  labels,
  running,
  start,
  stop,
  sessionErrorDuringAttemptRef,
}: UseBroadcastToggleOptions) {
  const { info, error: toastError } = useToast();
  const [togglePending, setTogglePending] = useState(false);
  const togglePendingRef = useRef(false);

  const toggleSession = async () => {
    if (togglePendingRef.current) return;

    const isStopping = running;
    togglePendingRef.current = true;
    sessionErrorDuringAttemptRef.current = false;
    setTogglePending(true);

    try {
      if (isStopping) {
        await stop();
        info(labels.sessionStopped);
      } else {
        await start();
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (sessionErrorDuringAttemptRef.current) return;
        info(labels.sessionStarted);
      }
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : '';
      const invalidApiKey =
        detail.includes('invalid_api_key') ||
        (detail.toLowerCase().includes('api key') && detail.toLowerCase().includes('not valid'));
      toastError(
        invalidApiKey
          ? labels.invalidApiKey
          : isStopping
            ? labels.stopFailed
            : labels.startFailed
      );
    } finally {
      togglePendingRef.current = false;
      setTogglePending(false);
    }
  };

  return { togglePending, toggleSession };
}