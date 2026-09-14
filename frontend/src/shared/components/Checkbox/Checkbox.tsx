import styles from './Checkbox.module.css';
import { useCheckbox } from './useCheckbox';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export default function Checkbox({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  ariaLabel,
}: CheckboxProps) {
  const { isChecked, handlePointerDown, handleClick, handleKeyDown } =
    useCheckbox({ checked, defaultChecked, onChange, disabled });

  return (
    <span
      className={`${styles.placer} ${disabled ? styles.disabled : ''}`}
      role="checkbox"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span
        className={`${styles.box} ${isChecked ? styles.checked : ''}`}
        aria-hidden="true"
      />
    </span>
  );
}
