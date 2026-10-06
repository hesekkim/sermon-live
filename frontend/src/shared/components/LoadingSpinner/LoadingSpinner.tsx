import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function LoadingSpinner({
  size = 'medium',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.spinner} ${styles[size]} ${className}`.trim()}
    />
  );
}
