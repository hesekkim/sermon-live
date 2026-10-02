import { useId } from 'react';
import styles from './SlideToggle.module.css';

export interface SlideToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export default function SlideToggle({
  label,
  checked,
  onChange,
  disabled = false,
}: SlideToggleProps) {
  const switchId = useId();

  return (
    <div className={styles.slideToggle}>
      <label htmlFor={switchId} className={styles.label}>
        {label}
      </label>
      <button
        type="button"
        id={switchId}
        className={styles.toggle}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <svg
          className={styles.icon}
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
            className={checked ? styles.trackOn : styles.trackOff}
          />
          <circle cx={checked ? 28 : 12} cy="20" r="6" className={styles.thumb} />
        </svg>
      </button>
    </div>
  );
}