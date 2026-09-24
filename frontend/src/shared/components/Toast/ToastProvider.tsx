/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import styles from './Toast.module.css';
import type { ToastApi } from './toastTypes';
import { useToastStore } from './useToastStore';

const ToastContext = createContext<ToastApi | null>(null);

export type ToastProviderProps = {
  children: React.ReactNode;
  closeLabel?: string;
};

export function ToastProvider({
  children,
  closeLabel = 'Close',
}: ToastProviderProps) {
  const { toasts, info, warning, error, dismiss } = useToastStore();
  const api = useMemo<ToastApi>(
    () => ({ info, warning, error, dismiss }),
    [info, warning, error, dismiss],
  );

  const viewport =
    typeof document !== 'undefined'
      ? createPortal(
          <div className={`cms-theme ${styles.viewport}`}>
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                toast={toast}
                onDismiss={dismiss}
                closeLabel={closeLabel}
              />
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {viewport}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return api;
}
