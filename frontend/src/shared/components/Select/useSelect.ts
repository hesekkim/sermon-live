import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface UseSelectParams {
  options: SelectOption[];
  value?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  searchable?: boolean;
}

const DROPDOWN_MAX_HEIGHT = 240;
const DROPDOWN_GAP = 4;

export function useSelect({
  options,
  value,
  onChange,
  placeholder = 'Please select...',
  disabled = false,
  id,
  searchable = false,
}: UseSelectParams) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const selectId = id ?? generatedId;

  const selectedLabel =
    value !== undefined && value !== null
      ? (options.find((option) => option.value === value)?.label ?? '')
      : '';
  const displayValue = selectedLabel || placeholder;

  const dropdownOptions = useMemo(() => {
    if (!searchable || !query.trim()) {
      return options;
    }

    const normalized = query.trim().toLowerCase();
    return options.filter((option) => {
      return (
        option.label.toLowerCase().includes(normalized) ||
        option.value.toLowerCase().includes(normalized)
      );
    });
  }, [options, query, searchable]);

  const updateDropdownPosition = () => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP;
    const spaceAbove = rect.top - DROPDOWN_GAP;
    const openUp =
      spaceBelow < Math.min(DROPDOWN_MAX_HEIGHT, 120) &&
      spaceAbove > spaceBelow;

    if (openUp) {
      setDropdownStyle({
        top: 'auto',
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(spaceAbove, 80)),
      });
      return;
    }

    setDropdownStyle({
      top: rect.bottom + DROPDOWN_GAP,
      bottom: 'auto',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(spaceBelow, 80)),
    });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, dropdownOptions.length]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () =>
      document.removeEventListener('click', handleDocumentClick, true);
  }, [dropdownOptions, isOpen, value]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setHighlightedIndex(-1);
      return;
    }

    const selectedIndex = dropdownOptions.findIndex(
      (option) => option.value === value,
    );
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [dropdownOptions, isOpen, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setHighlightedIndex((prev) => {
      if (dropdownOptions.length === 0) {
        return -1;
      }
      if (prev < 0) {
        return 0;
      }
      return Math.min(prev, dropdownOptions.length - 1);
    });
  }, [dropdownOptions, isOpen]);

  const openDropdown = () => {
    if (disabled) {
      return;
    }
    setIsOpen(true);
  };

  const toggleDropdown = () => {
    if (disabled) {
      return;
    }
    setIsOpen((open) => !open);
  };

  const handleSelectOption = (option: SelectOption) => {
    if (option.disabled) {
      return;
    }

    onChange?.(option.value);
    setIsOpen(false);
  };

  const moveHighlight = (delta: number) => {
    if (dropdownOptions.length === 0) {
      return;
    }

    setHighlightedIndex((prev) => {
      const start = prev < 0 ? (delta > 0 ? -1 : 0) : prev;
      const next =
        (start + delta + dropdownOptions.length) % dropdownOptions.length;
      return next;
    });
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === 'Enter') {
      if (!isOpen) {
        return;
      }
      event.preventDefault();
      const option = dropdownOptions[highlightedIndex];
      if (option) {
        handleSelectOption(option);
      }
      return;
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      searchInputRef.current?.blur();
    }
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleSearchFocus = () => {
    openDropdown();
  };

  const handleHighlightIndex = (index: number) => {
    setHighlightedIndex(index);
  };

  return {
    rootRef,
    dropdownRef,
    searchInputRef,
    selectId,
    isOpen,
    searchable,
    query,
    highlightedIndex,
    selectedLabel,
    displayValue,
    dropdownOptions,
    dropdownStyle,
    openDropdown,
    toggleDropdown,
    handleSelectOption,
    handleQueryChange,
    handleSearchFocus,
    handleListKeyDown,
    handleHighlightIndex,
  };
}
