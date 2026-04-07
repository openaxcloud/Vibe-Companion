import React, { ChangeEvent, FC, useCallback } from "react";

export type FilterStatus = "all" | "active" | "completed";

export interface FiltersProps {
  status: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
  className?: string;
  showSearch?: boolean;
}

const STATUS_OPTIONS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

export const Filters: FC<FiltersProps> = ({
  status,
  onStatusChange,
  searchText = "",
  onSearchTextChange,
  className = "",
  showSearch = true,
}) => {
  const handleStatusClick = useCallback(
    (value: FilterStatus) => {
      if (value !== status) {
        onStatusChange(value);
      }
    },
    [onStatusChange, status]
  );

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (!onSearchTextChange) return;
      onSearchTextChange(event.target.value);
    },
    [onSearchTextChange]
  );

  return (
    <div
      className={`filters-container flex flex-col gap-3 md:flex-row md:items-center md:justify-between undefined`}
    >
      <div className="filter-status flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => {
          const isActive = option.value === status;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleStatusClick(option.value)}
              className={[
                "px-3 py-1.5 text-sm font-medium rounded-full border transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
              ].join(" ")}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {showSearch && onSearchTextChange && (
        <div className="filter-search w-full md:w-auto">
          <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="filters-search-input">
            Search
          </label>
          <input
            id="filters-search-input"
            type="text"
            value={searchText}
            onChange={handleSearchChange}
            placeholder="Search..."
            className="w-full md:w-64 px-3 py-1.5 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
};

export default Filters;