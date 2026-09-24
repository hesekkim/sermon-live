import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastItem, ToastVariant } from './toastTypes';

const DEFAULT_DURATION_MS = 4000;

let toastIdCounter = 0;

function nextToastId() {
  toastIdCounter += 1;
  return `toast-${toastIdCounter}`;
}

export function useToastStore(durationMs = DEFAULT_DURATION_MS) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextToastId();
      setToasts((prev) => [...prev, { id, message, variant }]);

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, durationMs);
      timersRef.current.set(id, timer);

      return id;
    },
    [durationMs],
  );

  const info = useCallback((message: string) => push('info', message), [push]);
  const warning = useCallback(
    (message: string) => push('warning', message),
    [push],
  );
  const error = useCallback(
    (message: string) => push('error', message),
    [push],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return {
    toasts,
    info,
    warning,
    error,
    dismiss,
  };
}
