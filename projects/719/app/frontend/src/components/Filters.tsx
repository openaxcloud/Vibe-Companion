import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Slider,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Drawer,
  Button,
  useMediaQuery,
  Divider,
  Stack,
} from "@mui/material";
import { Theme, useTheme } from "@mui/material/styles";
import FilterListIcon from "@mui/icons-material/FilterList";
import CloseIcon from "@mui/icons-material/Close";

export type SortOptionValue = "relevance" | "price_asc" | "price_desc" | "newest";

export interface CategoryOption {
  id: string;
  label: string;
  count?: number;
}

export interface FiltersState {
  categories: string[];
  priceRange: [number, number];
  sortBy: SortOptionValue;
}

export interface FiltersProps {
  categories: CategoryOption[];
  minPrice: number;
  maxPrice: number;
  value: FiltersState;
  defaultValue?: FiltersState;
  sortOptions?: { value: SortOptionValue; label: string }[];
  onChange: (value: FiltersState) => void;
  /**
   * Optional callback when user applies filters on mobile drawer
   */
  onApply?: (value: FiltersState) => void;
  /**
   * Optional callback when user clears all filters
   */
  onClearAll?: () => void;
  /**
   * Optional flag to control external mobile drawer state
   */
  mobileOpenExternal?: boolean;
  /**
   * Optional handler if mobile drawer state is controlled from parent
   */
  onMobileOpenChange?: (open: boolean) => void;
}

const DEFAULT_SORT_OPTIONS: { value: SortOptionValue; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

const drawerWidth = 280;

const Filters: React.FC<FiltersProps> = ({
  categories,
  minPrice,
  maxPrice,
  value,
  defaultValue,
  sortOptions = DEFAULT_SORT_OPTIONS,
  onChange,
  onApply,
  onClearAll,
  mobileOpenExternal,
  onMobileOpenChange,
}) => {
  const theme: Theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpenInternal, setMobileOpenInternal] = useState<boolean>(false);

  const mobileOpen = mobileOpenExternal ?? mobileOpenInternal;

  const [draftFilters, setDraftFilters] = useState<FiltersState>(() => {
    if (defaultValue) return defaultValue;
    return {
      categories: [],
      priceRange: [minPrice, maxPrice],
      sortBy: "relevance",
    };
  });

  useEffect(() => {
    setDraftFilters((prev) => ({
      ...prev,
      ...value,
    }));
  }, [value]);

  const hasActiveFilters = useMemo(() => {
    const hasCategories = draftFilters.categories.length > 0;
    const hasPriceFilter =
      draftFilters.priceRange[0] !== minPrice || draftFilters.priceRange[1] !== maxPrice;
    const hasSort = draftFilters.sortBy !== "relevance";
    return hasCategories || hasPriceFilter || hasSort;
  }, [draftFilters, minPrice, maxPrice]);

  const handleCategoriesChange = useCallback(
    (categoryId: string) => {
      setDraftFilters((prev) => {
        const exists = prev.categories.includes(categoryId);
        const categoriesNext = exists
          ? prev.categories.filter((id) => id !== categoryId)
          : [...prev.categories, categoryId];

        const next = { ...prev, categories: categoriesNext };
        if (!isMobile) {
          onChange(next);
        }
        return next;
      });
    },
    [isMobile, onChange]
  );

  const handlePriceChange = useCallback(
    (_event: Event, newValue: number | number[]) => {
      if (!Array.isArray(newValue) || newValue.length !== 2) return;
      const clamped: [number, number] = [
        Math.max(minPrice, Math.min(newValue[0], maxPrice)),
        Math.max(minPrice, Math.min(newValue[1], maxPrice)),
      ];
      setDraftFilters((prev) => {
        const next = { ...prev, priceRange: clamped };
        if (!isMobile) {
          onChange(next);
        }
        return next;
      });
    },
    [isMobile, minPrice, maxPrice, onChange]
  );

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      const sortBy = event.target.value as SortOptionValue;
      setDraftFilters((prev) => {
        const next = { ...prev, sortBy };
        if (!isMobile) {
          onChange(next);
        }
        return next;
      });
    },
    [isMobile, onChange]
  );

  const handleMobileToggle = useCallback(
    (open: boolean) => {
      if (onMobileOpenChange) {
        onMobileOpenChange(open);
      } else {
        setMobileOpenInternal(open);
      }
    },
    [onMobileOpenChange]
  );

  const handleApply = useCallback(() => {
    onChange(draftFilters);
    if (onApply) onApply(draftFilters);
    handleMobileToggle(false);
  }, [draftFilters, handleMobileToggle, onApply, onChange]);

  const handleClearAll = useCallback(() => {
    const cleared: FiltersState = {
      categories: [],
      priceRange: [minPrice, maxPrice],
      sortBy: "relevance",
    };
    setDraftFilters(cleared);
    onChange(cleared);
    if (onClearAll) onClearAll();
  }, [minPrice, maxPrice, onChange, onClearAll]);

  const renderCategoryCheckboxes = () => (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Categories
      </Typography>
      <FormGroup>
        {categories.map((category) => (
          <FormControlLabel
            key={category.id}
            control={
              <Checkbox
                size="small"
                checked={draftFilters.categories.includes(category.id)}
                onChange={() => handleCategoriesChange(category.id)}
              />
            }
            label={
              <Box display="flex" justifyContent="space-between" width="100%">
                <Typography variant="body2">{category.label}</Typography>
                {typeof category.count === "number" && (
                  <Typography variant="caption" color="text.secondary">
                    {category.count}
                  </Typography>
                )}
              </Box>
            }
          />
        ))}
      </FormGroup>
    </Box>
  );

  const renderPriceRange = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Price Range
      </Typography>
      <Slider
        value={draftFilters.priceRange}
        onChange={handlePriceChange}
        valueLabelDisplay="auto"
        min={minPrice}
        max={maxPrice}
        size="small"
      />
      <Box display="flex" justifyContent="space-between">
        <Typography variant="caption" color="text.secondary">
          undefined
        </Typography>
        <Typography variant="caption" color="text.secondary">
          undefined
        </Typography>
      </Box>
    </Box>
  );

  const renderSort = () => (
    <Box sx={{ mt: 3 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select
          labelId="sort-by-label"
          label="Sort by"
          value={draftFilters.sortBy}
          onChange={handleSortChange as any}
        >
          {sortOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  const renderClearAllButton = () => (
    <Box sx={{ mt: 3 }}>
      <Button
        variant="text"
        color="inherit"
        size="small"
        disabled={!hasActiveFilters}
        onClick={handleClearAll}
      >
        Clear all
      </Button>
    </Box>
  );

  const renderFilterContent = () => (
    <Box
      sx={{
        p: 2,
        width: "100%",
      }}
    >
      {renderCategoryCheckboxes()}
      {renderPriceRange()}
      {renderSort()}
      {renderClearAllButton()}
    </Box>
  );

  if (isMobile) {
    return (
      <>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterListIcon />}