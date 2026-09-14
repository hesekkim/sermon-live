import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

const VARIANT_CLASS = {
  primary: 'button--primary',
  'primary-big': 'button--primary-big',
  secondary: 'button--secondary',
  'secondary-big': 'button--secondary-big',
  danger: 'button--danger',
  text: 'button--text',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASS;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: 'leading' | 'trailing';
  children?: ReactNode;
}

export default function Button({
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  icon,
  iconPosition = 'leading',
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const variantClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        styles.button,
        styles[variantClass],
        fullWidth ? styles['button--full-width'] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {icon && iconPosition === 'leading' && (
        <span className={styles['button__icon']} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles['button__label']}>{children}</span>
      {icon && iconPosition === 'trailing' && (
        <span className={styles['button__icon']} aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}
