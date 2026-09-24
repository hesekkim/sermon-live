import styles from './StatusTag.module.css';

const VARIANT_LABELS = {
  open: 'Open',
  answered: 'Answered',
  'response-needed': 'Response needed',
  decided: 'Decided',
  superseded: 'Superseded',
  deprecated: 'Deprecated',
  readonly: 'Read only',
} as const;

export type StatusTagVariant = keyof typeof VARIANT_LABELS | (string & {});

export interface StatusTagProps {
  variant?: StatusTagVariant;
  type?: 'published' | 'unpublished';
  label?: string;
  className?: string;
}

export default function StatusTag({
  variant = 'open',
  type,
  label,
  className = '',
}: StatusTagProps) {
  const resolvedVariant =
    type === 'published'
      ? 'decided'
      : type === 'unpublished'
        ? 'deprecated'
        : variant;
  const displayLabel =
    label ??
    VARIANT_LABELS[resolvedVariant as keyof typeof VARIANT_LABELS] ??
    resolvedVariant;

  return (
    <div
      className={`${styles.tag} ${styles[`tag--${resolvedVariant as string}`]} ${className}`.trim()}
      role="img"
      aria-label={displayLabel}
    >
      {variant === 'answered' && (
        <svg
          className={styles['tag__icon']}
          width="8"
          height="8"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.78 5.28a.75.75 0 0 0-1.06-1.06L7 7.94 5.28 6.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25z" />
        </svg>
      )}
      <p className={styles['tag__label']}>{displayLabel}</p>
    </div>
  );
}
