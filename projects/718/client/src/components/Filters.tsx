import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type SortField = "relevance" | "price" | "rating" | "newest";
type SortOrder = "asc" | "desc";

interface FiltersProps {
  /**
   * Available product categories
   */
  categories: string[];
  /**
   * Available tags that can be filtered on
   */
  tags: string[];
  /**
   * Min price bounds (for the slider / inputs)
   */
  minPriceBound?: number;
  /**
   * Max price bounds (for the slider / inputs)
   */
  maxPriceBound?: number;
  /**
   * Optional callback when filters change
   */
  onChange?: (filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
    sortField: SortField;
    sortOrder: SortOrder;
  }) => void;
  /**
   * Optional className for layout/styling
   */
  className?: string;
}

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 1000;

const SORT_LABELS: Record<SortField, string> = {
  relevance: "Relevance",
  price: "Price",
  rating: "Rating",
  newest: "Newest",
};

const Filters: React.FC<FiltersProps> = ({
  categories,
  tags,
  minPriceBound = DEFAULT_MIN_PRICE,
  maxPriceBound = DEFAULT_MAX_PRICE,
  onChange,
  className,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [sortField, setSortField] = useState<SortField>("relevance");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Initialize from query params
  useEffect(() => {
    const qpCategory = searchParams.get("category") || undefined;
    const qpTags = searchParams.get("tags");
    const qpMinPrice = searchParams.get("minPrice");
    const qpMaxPrice = searchParams.get("maxPrice");
    const qpSortField = searchParams.get("sortField") as SortField | null;
    const qpSortOrder = searchParams.get("sortOrder") as SortOrder | null;

    setCategory(qpCategory || undefined);

    if (qpTags) {
      setSelectedTags(
        qpTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    } else {
      setSelectedTags([]);
    }

    setMinPrice(qpMinPrice !== null ? Number(qpMinPrice) || undefined : undefined);
    setMaxPrice(qpMaxPrice !== null ? Number(qpMaxPrice) || undefined : undefined);

    if (qpSortField && SORT_LABELS[qpSortField]) {
      setSortField(qpSortField);
    } else {
      setSortField("relevance");
    }

    if (qpSortOrder === "asc" || qpSortOrder === "desc") {
      setSortOrder(qpSortOrder);
    } else {
      setSortOrder("desc");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateQueryParams = useCallback(
    (next: {
      category?: string;
      minPrice?: number;
      maxPrice?: number;
      tags?: string[];
      sortField?: SortField;
      sortOrder?: SortOrder;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      // Category
      if (next.category) {
        params.set("category", next.category);
      } else {
        params.delete("category");
      }

      // Price
      if (typeof next.minPrice === "number" && !Number.isNaN(next.minPrice)) {
        params.set("minPrice", String(next.minPrice));
      } else {
        params.delete("minPrice");
      }

      if (typeof next.maxPrice === "number" && !Number.isNaN(next.maxPrice)) {
        params.set("maxPrice", String(next.maxPrice));
      } else {
        params.delete("maxPrice");
      }

      // Tags
      if (next.tags && next.tags.length > 0) {
        params.set("tags", next.tags.join(","));
      } else {
        params.delete("tags");
      }

      // Sort
      if (next.sortField) {
        params.set("sortField", next.sortField);
      }
      if (next.sortOrder) {
        params.set("sortOrder", next.sortOrder);
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Notify parent on change
  useEffect(() => {
    if (!onChange) return;

    onChange({
      category,
      minPrice,
      maxPrice,
      tags: selectedTags,
      sortField,
      sortOrder,
    });
  }, [category, minPrice, maxPrice, selectedTags, sortField, sortOrder, onChange]);

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value || undefined;
      setCategory(value);
      updateQueryParams({
        category: value,
        minPrice,
        maxPrice,
        tags: selectedTags,
        sortField,
        sortOrder,
      });
    },
    [updateQueryParams, maxPrice, minPrice, selectedTags, sortField, sortOrder]
  );

  const handleTagToggle = useCallback(
    (tag: string) => {
      setSelectedTags((prev) => {
        const exists = prev.includes(tag);
        const nextTags = exists ? prev.filter((t) => t !== tag) : [...prev, tag];

        updateQueryParams({
          category,
          minPrice,
          maxPrice,
          tags: nextTags,
          sortField,
          sortOrder,
        });

        return nextTags;
      });
    },
    [category, maxPrice, minPrice, sortField, sortOrder, updateQueryParams]
  );

  const clampPrice = useCallback(
    (value: number | undefined): number | undefined => {
      if (typeof value !== "number" || Number.isNaN(value)) return undefined;
      if (value < minPriceBound) return minPriceBound;
      if (value > maxPriceBound) return maxPriceBound;
      return value;
    },
    [minPriceBound, maxPriceBound]
  );

  const handleMinPriceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const numeric = raw === "" ? undefined : Number(raw);
      const clamped = clampPrice(numeric);
      const sane =
        typeof clamped === "number" && typeof maxPrice === "number"
          ? Math.min(clamped, maxPrice)
          : clamped;

      setMinPrice(sane);
      updateQueryParams({
        category,
        minPrice: sane,
        maxPrice,
        tags: selectedTags,
        sortField,
        sortOrder,
      });
    },
    [category, clampPrice, maxPrice, selectedTags, sortField, sortOrder, updateQueryParams]
  );

  const handleMaxPriceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      const numeric = raw === "" ? undefined : Number(raw);
      const clamped = clampPrice(numeric);
      const sane =
        typeof clamped === "number" && typeof minPrice === "number"
          ? Math.max(clamped, minPrice)
          : clamped;

      setMaxPrice(sane);
      updateQueryParams({
        category,
        minPrice,
        maxPrice: sane,
        tags: selectedTags,
        sortField,
        sortOrder,
      });
    },
    [category, clampPrice, minPrice, selectedTags, sortField, sortOrder, updateQueryParams]
  );

  const handleSortFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as SortField;
      const nextField: SortField = SORT_LABELS[value] ? value : "relevance";
      setSortField(nextField);
      updateQueryParams({
        category,
        minPrice,
        maxPrice,
        tags: selectedTags,
        sortField: nextField,
        sortOrder,
      });
    },
    [category, maxPrice, minPrice, selectedTags, sortOrder, updateQueryParams]
  );

  const handleSortOrderToggle = useCallback(() => {
    setSortOrder((prev) => {
      const next: SortOrder = prev === "asc" ? "desc" : "asc";
      updateQueryParams({
        category,
        minPrice,
        maxPrice,
        tags: selectedTags,
        sortField,
        sortOrder: next,
      });
      return next;
    });
  }, [category, maxPrice, minPrice, selectedTags, sortField, updateQueryParams]);

  const handleClearFilters = useCallback(() => {