import {
  type ChangeEvent,
  type FocusEvent,
  type MouseEvent,
  useId,
  useState,
} from 'react';

export interface UseInputFieldParams {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  id?: string;
  clearable?: boolean;
  disabled?: boolean;
}

export function useInputField({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  id,
  clearable = false,
  disabled = false,
}: UseInputFieldParams) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? ''
  );
  const [isFocused, setIsFocused] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const currentValue = isControlled ? value : uncontrolledValue;
  const showClearButton =
    clearable && !disabled && String(currentValue ?? '').length > 0;

  const handleFocus = (
    event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (
    event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const nextValue = event.target.value;
    if (!isControlled) {
      setUncontrolledValue(nextValue);
    }
    onChange?.(nextValue);
  };

  const handleClear = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isControlled) {
      setUncontrolledValue('');
    }
    onChange?.('');
  };

  return {
    inputId,
    isControlled,
    currentValue,
    isFocused,
    showClearButton,
    handleFocus,
    handleBlur,
    handleChange,
    handleClear,
  };
}
