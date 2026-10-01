import { useRef, useState, type MutableRefObject } from 'react';
import { useToast } from '../../../../shared/components/Toast/ToastProvider';
import type { OperatorCopy } from '../../translations';
import type { TranslationSessionStatus } from './useBroadcastSession';

interface UseBroadcastToggleOptions {
  labels: OperatorCopy;
  sessionStatus: TranslationSessionStatus;
  start: () => Promise<void>;
  beforeStart?: () => Promise<boolean>;
  clearTranscripts?: () => void;
  stop: () => Promise<void>;
  extend: () => Promise<unknown>;
  sessionErrorDuringAttemptRef: MutableRefObject<boolean>;
}

export function useBroadcastToggle({
  labels,
  sessionStatus,
  start,
  beforeStart = async () => true,
  clearTranscripts = () => undefined,
  stop,
  extend,
  sessionErrorDuringAttemptRef,
}: UseBroadcastToggleOptions) {
  const { info, error: toastError } = useToast();
  const [actionPending, setActionPending] = useState(false);
  const actionPendingRef = useRef(false);

  const runPendingAction = async (
    action: () => Promise<unknown>,
    onError: (caught: unknown) => void,
  ) => {
    if (actionPendingRef.current) return;

    actionPendingRef.current = true;
    setActionPending(true);
    try {
      await action();
    } catch (caught) {
      onError(caught);
    } finally {
      actionPendingRef.current = false;
      setActionPending(false);
    }
  };

  const toggleSession = async () => {
    if (actionPendingRef.current) return;

    const isStopping = sessionStatus === 'live';
    sessionErrorDuringAttemptRef.current = false;

    await runPendingAction(
      async () => {
        if (isStopping) {
          await stop();
          info(labels.sessionStopped);
        } else {
          if (!(await beforeStart())) return;
          clearTranscripts();
          await start();
          await new Promise((resolve) => setTimeout(resolve, 150));
          if (sessionErrorDuringAttemptRef.current) return;
          info(labels.sessionStarted);
        }
      },
      (caught) => {
        const detail = caught instanceof Error ? caught.message : '';
        const invalidApiKey =
          detail.includes('invalid_api_key') ||
          (detail.toLowerCase().includes('api key') &&
            detail.toLowerCase().includes('not valid'));
        toastError(
          invalidApiKey
            ? labels.invalidApiKey
            : isStopping
              ? labels.stopFailed
              : labels.startFailed,
        );
      },
    );
  };

  const stopNow = () =>
    runPendingAction(
      async () => {
        await stop();
        info(labels.sessionStopped);
      },
      () => toastError(labels.stopFailed),
    );

  const extendSession = () =>
    runPendingAction(extend, () => toastError(labels.extendFailed));

  return { actionPending, toggleSession, stopNow, extendSession };
}
