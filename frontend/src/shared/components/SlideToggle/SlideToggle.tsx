import { useId } from 'react';
import styles from './SlideToggle.module.css';

export interface SlideToggleProps {
  label?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export default function SlideToggle({
  label,
  checked = false,
  onChange,
  disabled = false,
}: SlideToggleProps) {
  const switchId = useId();

  const toggle = () => {
    if (!disabled) {
      onChange?.(!checked);
    }
  };

  return (
    <div className={styles['slide-toggle']}>
      {label && (
        <label htmlFor={switchId} className={styles['slide-toggle__label']}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={switchId}
        className={styles['slide-toggle__toggle']}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={toggle}
      >
        <svg
          className={`${styles['slide-toggle__icon']} ${checked ? styles['slide-toggle__icon--on'] : ''}`}
          width="32"
          height="16"
          viewBox="4 12 32 16"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="12"
            width="32"
            height="16"
            rx="8"
            className={
              checked
                ? styles['slide-toggle__track--on']
                : styles['slide-toggle__track--off']
            }
          />
          <circle
            cx={checked ? 28 : 12}
            cy="20"
            r="6"
            className={styles['slide-toggle__thumb']}
          />
        </svg>
      </button>
    </div>
  );
}
