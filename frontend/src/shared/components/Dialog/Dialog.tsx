import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useId } from 'react';
import { IoMdClose } from 'react-icons/io';
import styles from './Dialog.module.css';
import { useDialog } from './useDialog';

export interface DialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  overlayClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  /** When false, footer has no top border (default true). */
  showFooterDivider?: boolean;
}

export default function Dialog({
  isOpen,
  title,
  children,
  onClose,
  closeLabel = 'Close',
  footer,
  size = 'md',
  className = '',
  overlayClassName = '',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showFooterDivider = true,
}: DialogProps) {
  const titleId = useId();
  useDialog({ isOpen, onClose, closeOnEscape });

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = () => {
    if (closeOnOverlayClick) {
      onClose();
    }
  };

  const dialogClassName = [
    styles.dialog,
    size === 'sm' ? styles['dialog--sm'] : '',
    size === 'lg' ? styles['dialog--lg'] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const footerClassName = [
    styles.footer,
    showFooterDivider ? '' : styles['footer--noDivider'],
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      className={`cms-theme ${styles.overlay} ${overlayClassName}`}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={closeLabel}
          >
            <IoMdClose aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer ? <div className={footerClassName}>{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
