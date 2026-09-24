import { createPortal } from 'react-dom';
import { FaChevronDown } from 'react-icons/fa';
import styles from './Select.module.css';
import { useSelect, type SelectOption } from './useSelect';

export type { SelectOption };

export interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  errorMessage?: string;
  id?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  openOptionsLabel?: string;
  closeOptionsLabel?: string;
  className?: string;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Please select...',
  disabled = false,
  error = false,
  errorMessage = '',
  id,
  searchable = false,
  searchPlaceholder = 'Type to search...',
  emptyMessage = 'No matches',
  openOptionsLabel = 'Open options',
  closeOptionsLabel = 'Close options',
  className = '',
}: SelectProps) {
  const {
    rootRef,
    dropdownRef,
    searchInputRef,
    selectId,
    isOpen,
    query,
    highlightedIndex,
    selectedLabel,
    displayValue,
    dropdownOptions,
    dropdownStyle,
    toggleDropdown,
    handleSelectOption,
    handleQueryChange,
    handleSearchFocus,
    handleListKeyDown,
    handleHighlightIndex,
  } = useSelect({
    options,
    value,
    onChange,
    placeholder,
    disabled,
    id,
    searchable,
  });

  const fieldClassName = [
    styles['select__field'],
    error ? styles['select__field--error'] : '',
    disabled ? styles['select__field--disabled'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const labelClassName = [
    styles['select__label'],
    error ? styles['select__label--error'] : '',
  ]
    .filter(Boolean)
    .join(' ');

  const dropdown = isOpen
    ? createPortal(
        <ul
          ref={dropdownRef}
          className={`${styles['select__dropdown']} ${styles['select__dropdown--portal']}`}
          style={dropdownStyle}
          role="listbox"
          aria-labelledby={selectId}
        >
          {dropdownOptions.length === 0 ? (
            <li className={styles['select__empty']}>{emptyMessage}</li>
          ) : (
            dropdownOptions.map((option, index) => (
              <li key={option.value || '__placeholder__'}>
                <button
                  type="button"
                  id={`${selectId}-option-${index}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-label={option.label}
                  className={[
                    styles['select__option'],
                    option.value === value
                      ? styles['select__option--active']
                      : '',
                    index === highlightedIndex
                      ? styles['select__option--highlighted']
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={option.disabled}
                  onMouseEnter={() => handleHighlightIndex(index)}
                  onClick={() => handleSelectOption(option)}
                >
                  <span className={styles['select__option-label']}>
                    {option.label}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div
      className={[styles.select, className].filter(Boolean).join(' ')}
      ref={rootRef}
    >
      <label className={labelClassName} htmlFor={selectId}>
        {label}
      </label>

      {searchable ? (
        <div className={fieldClassName}>
          <span className={styles['select__value-row']}>
            <input
              ref={searchInputRef}
              id={selectId}
              type="text"
              className={styles['select__input']}
              value={query}
              placeholder={searchPlaceholder || placeholder}
              disabled={disabled}
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-activedescendant={
                isOpen && highlightedIndex >= 0
                  ? `${selectId}-option-${highlightedIndex}`
                  : undefined
              }
              autoComplete="off"
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={handleSearchFocus}
              onKeyDown={handleListKeyDown}
            />
            <button
              type="button"
              className={styles['select__chevron-button']}
              tabIndex={-1}
              disabled={disabled}
              aria-label={isOpen ? closeOptionsLabel : openOptionsLabel}
              onClick={toggleDropdown}
            >
              <FaChevronDown
                className={styles['select__chevron']}
                aria-hidden="true"
              />
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          id={selectId}
          className={fieldClassName}
          disabled={disabled}
          aria-label={displayValue}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            isOpen && highlightedIndex >= 0
              ? `${selectId}-option-${highlightedIndex}`
              : undefined
          }
          onClick={toggleDropdown}
          onKeyDown={handleListKeyDown}
        >
          <span className={styles['select__value-row']}>
            <span
              className={[
                styles['select__value'],
                !selectedLabel ? styles['select__value--placeholder'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {displayValue}
            </span>
            <FaChevronDown
              className={styles['select__chevron']}
              aria-hidden="true"
            />
          </span>
        </button>
      )}

      {error && errorMessage && (
        <span className={styles['select__error-message']}>{errorMessage}</span>
      )}

      {dropdown}
    </div>
  );
}
