import React, { useEffect, useMemo, useState, useCallback } from "react";

export interface SearchBarProps {
  /**
   * The current search term value controlled by parent
   */
  value: string;
  /**
   * Called when the debounced search term changes
   */
  onChange: (value: string) => void;
  /**
   * Placeholder text for the input
   */
  placeholder?: string;
  /**
   * Debounce delay in milliseconds
   */
  debounceDelay?: number;
  /**
   * Optional className for outer wrapper
   */
  className?: string;
  /**
   * Optional aria-label for accessibility
   */
  ariaLabel?: string;
  /**
   * If true, input will autofocus on mount
   */
  autoFocus?: boolean;
}

const DEFAULT_DEBOUNCE_DELAY = 300;

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = "Search products...",
  debounceDelay = DEFAULT_DEBOUNCE_DELAY,
  className = "",
  ariaLabel = "Product search",
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState<string>(value);

  // Keep internal value in sync with parent when parent changes externally
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const debouncedChange = useMemo(() => {
    let timeoutId: number | undefined;

    const fn = (nextValue: string) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        onChange(nextValue);
      }, debounceDelay);
    };

    // Return a function with a cancel method for cleanup
    const wrapped = (nextValue: string) => fn(nextValue);
    (wrapped as any).cancel = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };

    return wrapped as ((v: string) => void) & { cancel?: () => void };
  }, [onChange, debounceDelay]);

  useEffect(() => {
    return () => {
      if (debouncedChange.cancel) {
        debouncedChange.cancel();
      }
    };
  }, [debouncedChange]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      setInternalValue(nextValue);
      debouncedChange(nextValue);
    },
    [debouncedChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setInternalValue("");
        debouncedChange("");
      }
    },
    [debouncedChange]
  );

  return (
    <div className={className}>
      <div
        className="relative flex items-center rounded-md border border-gray-300 bg-white px-3 py-1 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
      >
        <span
          className="pointer-events-none mr-2 text-gray-400"
          aria-hidden="true"
        >
          <svg
            className="h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.5 3a5.5 5.5 0 013.993 9.357l3.575 3.575a.75.75 0 11-1.06 1.06l-3.575-3.575A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <input
          type="text"
          value={internalValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          className="block w-full border-0 p-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
        />
        {internalValue && (
          <button
            type="button"
            onClick={() => {
              setInternalValue("");
              debouncedChange("");
            }}
            className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
            aria-label="Clear search"
          >
            <svg
              className="h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M3.5 3.5L10.5 10.5M3.5 10.5L10.5 3.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;