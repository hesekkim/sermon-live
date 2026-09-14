import { IoMdClose } from 'react-icons/io';
import {
  MdErrorOutline,
  MdInfoOutline,
  MdWarningAmber,
} from 'react-icons/md';
import styles from './Toast.module.css';
import type { ToastItem, ToastVariant } from './toastTypes';

const VARIANT_ICONS: Record<
  ToastVariant,
  typeof MdInfoOutline
> = {
  info: MdInfoOutline,
  warning: MdWarningAmber,
  error: MdErrorOutline,
};

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  closeLabel: string;
}

export default function Toast({ toast, onDismiss, closeLabel }: ToastProps) {
  const Icon = VARIANT_ICONS[toast.variant];
  const isError = toast.variant === 'error';

  return (
    <div
      className={`${styles.toast} ${styles[`toast--${toast.variant}`]}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{toast.message}</p>
      <button
        type="button"
        className={styles.closeButton}
        onClick={() => onDismiss(toast.id)}
        aria-label={closeLabel}
      >
        <IoMdClose aria-hidden="true" />
      </button>
    </div>
  );
}
