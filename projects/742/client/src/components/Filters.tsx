import React, { useCallback, useEffect, useMemo, useState } from "react";

export type CategoryOption = {
  id: string;
  label: string;
};

export type TagOption = {
  id: string;
  label: string;
};

export type FiltersQuery = {
  categories: string[];
  minPrice?: number;
  maxPrice?: number;
  tags: string[];
};

export type FiltersProps = {
  categories: CategoryOption[];
  tags: TagOption[];
  initialQuery?: Partial<FiltersQuery>;
  minAllowedPrice?: number;
  maxAllowedPrice?: number;
  onChange: (query: FiltersQuery) => void;
  /**
   * Optional debounce delay (ms) before emitting changes.
   * Defaults to 300ms.
   */
  debounceMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 300;

const parseNumberOrUndefined = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (Number.isNaN(num)) return undefined;
  if (!Number.isFinite(num)) return undefined;
  return num;
};

const clampNumber = (
  value: number | undefined,
  min?: number,
  max?: number
): number | undefined => {
  if (value === undefined) return undefined;
  let result = value;
  if (min !== undefined && result < min) result = min;
  if (max !== undefined && result > max) result = max;
  return result;
};

export const Filters: React.FC<FiltersProps> = ({
  categories,
  tags,
  initialQuery,
  minAllowedPrice,
  maxAllowedPrice,
  onChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    () => initialQuery?.categories ?? []
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    () => initialQuery?.tags ?? []
  );
  const [minPriceInput, setMinPriceInput] = useState<string>(
    initialQuery?.minPrice !== undefined ? String(initialQuery.minPrice) : ""
  );
  const [maxPriceInput, setMaxPriceInput] = useState<string>(
    initialQuery?.maxPrice !== undefined ? String(initialQuery.maxPrice) : ""
  );

  const query: FiltersQuery = useMemo(() => {
    const parsedMin = parseNumberOrUndefined(minPriceInput);
    const parsedMax = parseNumberOrUndefined(maxPriceInput);

    const clampedMin = clampNumber(parsedMin, minAllowedPrice, maxAllowedPrice);
    const clampedMax = clampNumber(parsedMax, minAllowedPrice, maxAllowedPrice);

    return {
      categories: selectedCategories,
      tags: selectedTags,
      minPrice: clampedMin,
      maxPrice: clampedMax,
    };
  }, [
    selectedCategories,
    selectedTags,
    minPriceInput,
    maxPriceInput,
    minAllowedPrice,
    maxAllowedPrice,
  ]);

  useEffect(() => {
    let isCancelled = false;
    const timeout = window.setTimeout(() => {
      if (!isCancelled) {
        onChange(query);
      }
    }, debounceMs);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query, onChange, debounceMs]);

  const handleCategoryToggle = useCallback(
    (id: string) => {
      setSelectedCategories((prev) =>
        prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
      );
    },
    [setSelectedCategories]
  );

  const handleTagToggle = useCallback(
    (id: string) => {
      setSelectedTags((prev) =>
        prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
      );
    },
    [setSelectedTags]
  );

  const handleMinPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (/^[0-9]*([.,][0-9]*)?$/.test(value) || value === "") {
        setMinPriceInput(value.replace(",", "."));
      }
    },
    []
  );

  const handleMaxPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (/^[0-9]*([.,][0-9]*)?$/.test(value) || value === "") {
        setMaxPriceInput(value.replace(",", "."));
      }
    },
    []
  );

  const handleClear = useCallback(() => {
    setSelectedCategories([]);
    setSelectedTags([]);
    setMinPriceInput("");
    setMaxPriceInput("");
  }, []);

  const allCategoriesSelected =
    categories.length > 0 &&
    selectedCategories.length === categories.length;

  const allTagsSelected = tags.length > 0 && selectedTags.length === tags.length;

  const handleToggleAllCategories = useCallback(() => {
    if (allCategoriesSelected) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(categories.map((c) => c.id));
    }
  }, [allCategoriesSelected, categories]);

  const handleToggleAllTags = useCallback(() => {
    if (allTagsSelected) {
      setSelectedTags([]);
    } else {
      setSelectedTags(tags.map((t) => t.id));
    }
  }, [allTagsSelected, tags]);

  return (
    <aside
      aria-label="Filters"
      style={{
        borderRight: "1px solid #e5e7eb",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        minWidth: "240px",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            margin: 0,
          }}
        >
          Filters
        </h2>
        <button
          type="button"
          onClick={handleClear}
          style={{
            border: "none",
            background: "none",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "0.875rem",
            padding: 0,
          }}
        >
          Clear all
        </button>
      </header>

      <section aria-label="Category filters">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.25rem",
          }}
        >
          <h3
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Categories
          </h3>
          {categories.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAllCategories}
              style={{
                border: "none",
                background: "none",
                color: "#4b5563",
                cursor: "pointer",
                fontSize: "0.75rem",
                padding: 0,
              }}
            >
              {allCategoriesSelected ? "Unselect all" : "Select all"}
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {categories.length === 0 && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#6b7280",
                margin: 0,
              }}
            >
              No categories available.
            </p>
          )}
          {categories.map((category) => (
            <label
              key={category.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
                cursor: "pointer",
                color: "#111827",
              }}
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.id)}
                onChange={() => handleCategoryToggle(category.id)}
              />
              <span>{category.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section aria-label="Price filters">
        <h3
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            margin: 0,
            marginBottom: "0.25rem",
          }}
        >
          Price range
        </h3>
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "#6b7280",
                marginBottom: "0.125rem",
              }}
            >
              Min
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={minPriceInput}
              onChange={handleMin