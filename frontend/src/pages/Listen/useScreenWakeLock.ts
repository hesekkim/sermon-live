import { useEffect, useRef, useState } from 'react';

export type ScreenWakeLockStatus =
  | 'inactive'
  | 'requesting'
  | 'active'
  | 'unsupported'
  | 'insecure'
  | 'requestFailed'
  | 'released';

export function useScreenWakeLock(enabled: boolean): ScreenWakeLockStatus {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [status, setStatus] = useState<ScreenWakeLockStatus>('inactive');

  useEffect(() => {
    if (!enabled) {
      setStatus('inactive');
      return;
    }
    if (!window.isSecureContext) {
      setStatus('insecure');
      return;
    }
    if (!('wakeLock' in navigator)) {
      setStatus('unsupported');
      return;
    }

    let disposed = false;
    let requestPending = false;

    const requestWakeLock = async () => {
      if (disposed || document.visibilityState !== 'visible' || requestPending) {
        return;
      }
      if (wakeLockRef.current && !wakeLockRef.current.released) return;

      wakeLockRef.current = null;
      requestPending = true;
      setStatus('requesting');
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        if (disposed) {
          await wakeLock.release();
          return;
        }
        if (wakeLock.released) {
          setStatus('released');
          return;
        }

        wakeLockRef.current = wakeLock;
        wakeLock.addEventListener(
          'release',
          () => {
            if (wakeLockRef.current !== wakeLock) return;
            wakeLockRef.current = null;
            if (!disposed) setStatus('released');
          },
          { once: true },
        );
        setStatus('active');
      } catch {
        if (!disposed) setStatus('requestFailed');
      } finally {
        requestPending = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void requestWakeLock();
    };

    void requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const wakeLock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (wakeLock && !wakeLock.released) void wakeLock.release();
    };
  }, [enabled]);

  return status;
}
