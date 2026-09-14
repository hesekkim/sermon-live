import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useState,
} from 'react';

export interface UseCheckboxParams {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function useCheckbox({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
}: UseCheckboxParams) {
  const isControlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] =
    useState(defaultChecked);
  const isChecked = isControlled ? checked : uncontrolledChecked;

  const toggle = () => {
    if (disabled) {
      return;
    }

    const nextChecked = !isChecked;
    if (!isControlled) {
      setUncontrolledChecked(nextChecked);
    }
    onChange?.(nextChecked);
  };

  const handlePointerDown = (event: PointerEvent) => {
    event.stopPropagation();
  };

  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    toggle();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    }
  };

  return {
    isChecked,
    handlePointerDown,
    handleClick,
    handleKeyDown,
  };
}
