import React, { useState } from 'react';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface FilterSidebarProps {
  onFilterChange: (filters: { category: string; priceRange: [number, number] }) => void;
  currentFilters: { category: string; priceRange: [number, number] };
}

const categories = ['All', 'Electronics', 'Clothing', 'Books', 'Home & Kitchen', 'Sports']; // Example categories
const priceRanges = [
  { label: 'All Prices', range: [0, 100000] },
  { label: 'Under $50', range: [0, 50] },
  { label: '$50 - $100', range: [50, 100] },
  { label: '$100 - $500', range: [100, 500] },
  { label: 'Over $500', range: [500, 100000] },
];

const FilterSidebar: React.FC<FilterSidebarProps> = ({ onFilterChange, currentFilters }) => {
  const [selectedCategory, setSelectedCategory] = useState(currentFilters.category);
  const [selectedPriceRange, setSelectedPriceRange] = useState(currentFilters.priceRange);
  const [isCategoryOpen, setIsCategoryOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    onFilterChange({ ...currentFilters, category });
  };

  const handlePriceChange = (range: [number, number]) => {
    setSelectedPriceRange(range);
    onFilterChange({ ...currentFilters, priceRange: range });
  };

  return (
    <div className="w-full md:w-64 bg-gradient-to-b from-slate-900 to-slate-800 rounded-lg shadow-xl p-6 h-fit sticky top-28 animate-slide-up">
      <h2 className="text-2xl font-bold text-primary-400 mb-6 flex items-center gap-3">
        <Filter size={24} /> Filters
      </h2>

      <div className="mb-6">
        <button
          onClick={() => setIsCategoryOpen(!isCategoryOpen)}
          className="flex justify-between items-center w-full py-2 text-slate-50 font-semibold text-lg hover:text-primary-400 transition-colors"
        >
          Categories {isCategoryOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {isCategoryOpen && (
          <ul className="mt-3 space-y-2 animate-fade-in">
            {categories.map((category) => (
              <li key={category}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="category"
                    value={category}
                    checked={selectedCategory === category}
                    onChange={() => handleCategoryChange(category)}
                    className="form-radio h-4 w-4 text-primary-600 transition-colors duration-200"
                  />
                  <span className="ml-3 text-slate-300 hover:text-white transition-colors">{category}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <button
          onClick={() => setIsPriceOpen(!isPriceOpen)}
          className="flex justify-between items-center w-full py-2 text-slate-50 font-semibold text-lg hover:text-primary-400 transition-colors"
        >
          Price Range {isPriceOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
        {isPriceOpen && (
          <ul className="mt-3 space-y-2 animate-fade-in">
            {priceRanges.map((rangeOption) => (
              <li key={rangeOption.label}>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="priceRange"
                    value={rangeOption.label}
                    checked={selectedPriceRange[0] === rangeOption.range[0] && selectedPriceRange[1] === rangeOption.range[1]}
                    onChange={() => handlePriceChange(rangeOption.range)}
                    className="form-radio h-4 w-4 text-primary-600 transition-colors duration-200"
                  />
                  <span className="ml-3 text-slate-300 hover:text-white transition-colors">{rangeOption.label}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FilterSidebar;