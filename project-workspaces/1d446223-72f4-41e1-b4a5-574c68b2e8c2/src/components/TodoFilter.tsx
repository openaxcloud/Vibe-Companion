import React from 'react';
import { FilterType } from '../types/todo';

interface TodoFilterProps {
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  activeCount: number;
  completedCount: number;
}

export const TodoFilter: React.FC<TodoFilterProps> = ({
  currentFilter,
  onFilterChange,
  activeCount,
  completedCount,
}) => {
  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'All', count: activeCount + completedCount },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'completed', label: 'Completed', count: completedCount },
  ];

  return (
    <div className="flex gap-2 mt-6">
      {filters.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            currentFilter === key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {label} ({count})
        </button>
      ))}
    </div>
  );
};