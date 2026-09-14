import { BiX } from 'react-icons/bi';
import styles from './TagSelector.module.css';

export interface TagSelectorProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  icon?: 'plus';
}

export default function TagSelector({
  label,
  selected = false,
  onClick,
  onRemove,
  removeLabel = 'Remove',
  disabled = false,
  icon,
}: TagSelectorProps) {
  const stateClass = [
    selected ? styles['tag-selector--selected'] : '',
    disabled ? styles['tag-selector--disabled'] : '',
    onRemove ? styles['tag-selector--removable'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (onRemove) {
    return (
      <span className={`${styles['tag-selector']} ${stateClass}`}>
        <span className={styles['tag-selector__label']}>{label}</span>
        <button
          type="button"
          className={styles['tag-selector__remove']}
          aria-label={removeLabel}
          disabled={disabled}
          onClick={onRemove}
        >
          <BiX aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles['tag-selector']} ${stateClass}`}
      onClick={onClick}
      disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
    >
      {icon === 'plus' ? (
        <svg
          className={styles['tag-selector__icon']}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" />
        </svg>
      ) : null}
      <span className={styles['tag-selector__label']}>{label}</span>
    </button>
  );
}
