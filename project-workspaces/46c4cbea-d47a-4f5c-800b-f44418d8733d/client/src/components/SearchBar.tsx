import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
  initialSearchTerm?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, initialSearchTerm = '' }) => {
  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center w-full max-w-xl mx-auto mb-8 card-glass p-2">
      <input
        type="text"
        placeholder="Search for products..."
        value={searchTerm}
        onChange={handleChange}
        className="flex-grow p-3 bg-transparent text-white placeholder-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        className="bg-primary-600 hover:bg-primary-700 text-white p-3 rounded-md transition-colors duration-200 ml-2"
        aria-label="Search"
      >
        <Search size={20} />
      </button>
    </form>
  );
};

export default SearchBar;