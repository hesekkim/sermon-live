import {
  forwardRef,
  type FocusEvent,
  type HTMLInputTypeAttribute,
} from 'react';
import styles from './InputField.module.css';
import { useInputField } from './useInputField';

export interface InputFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  multiline?: boolean;
  clearable?: boolean;
  clearButtonLabel?: string;
  autoFocus?: boolean;
  id?: string;
  rows?: number;
  name?: string;
  type?: HTMLInputTypeAttribute;
  pattern?: string;
  inputMode?:
    | 'none'
    | 'text'
    | 'tel'
    | 'url'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'search';
  required?: boolean;
  maxLength?: number;
  className?: string;
  onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

const InputField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputFieldProps
>(function InputField(
  {
    label,
    value,
    defaultValue,
    onChange,
    placeholder = '',
    error = false,
    errorMessage = '',
    disabled = false,
    multiline = false,
    clearable = false,
    clearButtonLabel = 'Clear input',
    onBlur,
    onFocus,
    autoFocus = false,
    id,
    rows = 3,
    name,
    type = 'text',
    pattern,
    inputMode,
    required,
    maxLength,
    className = '',
  },
  ref,
) {
  const {
    inputId,
    currentValue,
    isFocused,
    showClearButton,
    handleFocus,
    handleBlur,
    handleChange,
    handleClear,
  } = useInputField({
    value,
    defaultValue,
    onChange,
    onBlur,
    onFocus,
    id,
    clearable,
    disabled,
  });

  const fieldClassName = [
    styles['input-field__field'],
    error ? styles['input-field__field--error'] : '',
    isFocused && !error && !disabled
      ? styles['input-field__field--focused']
      : '',
    disabled ? styles['input-field__field--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sharedProps = {
    id: inputId,
    className: styles['input-field__input'],
    value: currentValue,
    onChange: handleChange,
    placeholder,
    disabled,
    name,
    required,
    maxLength,
    'aria-invalid': error,
    onFocus: handleFocus,
    onBlur: handleBlur,
    autoFocus,
  };

  return (
    <div
      className={[styles['input-field'], className].filter(Boolean).join(' ')}
    >
      <div className={styles['input-field__label-row']}>
        <label
          htmlFor={inputId}
          className={[
            styles['input-field__label'],
            error ? styles['input-field__label--error'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {label}
        </label>
        {showClearButton ? (
          <button
            type="button"
            className={styles['input-field__clear-button']}
            onClick={handleClear}
            onMouseDown={(event) => event.preventDefault()}
            aria-label={clearButtonLabel}
            title={clearButtonLabel}
          >
            ×
          </button>
        ) : null}
      </div>

      <div className={fieldClassName}>
        {multiline ? (
          <textarea
            {...sharedProps}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            rows={rows}
          />
        ) : (
          <input
            {...sharedProps}
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
            pattern={pattern}
            inputMode={inputMode}
          />
        )}
      </div>

      {error && errorMessage && (
        <span className={styles['input-field__error-message']}>
          {errorMessage}
        </span>
      )}
    </div>
  );
});

export default InputField;
