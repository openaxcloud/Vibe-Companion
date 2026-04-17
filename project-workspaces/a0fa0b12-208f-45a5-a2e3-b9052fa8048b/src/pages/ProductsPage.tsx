import React, { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { Product } from '../utils/types';
import * as productService from '../services/productService';
import { Search, Filter, XCircle } from 'lucide-react';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | ''>('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (searchTerm) queryParams.append('search', searchTerm);
        if (categoryFilter) queryParams.append('category', categoryFilter);
        if (minPrice) queryParams.append('minPrice', minPrice);
        if (maxPrice) queryParams.append('maxPrice', maxPrice);
        if (sortOrder) queryParams.append('sort', sortOrder);

        const data = await productService.getProducts(queryParams.toString());
        setProducts(data);

        // Extract unique categories from fetched products
        const uniqueCategories = Array.from(new Set(data.map(p => p.category).filter(Boolean) as string[]));
        setCategories(uniqueCategories);

      } catch (err) {
        setError('Failed to fetch products.');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [searchTerm, categoryFilter, minPrice, maxPrice, sortOrder]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('');
    setMinPrice('');
    setMaxPrice('');
    setSortOrder('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* Sidebar for filters */}
      <aside className="md:col-span-1 bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark h-fit sticky top-28">
        <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2">
          <Filter size={24} /> Filters
        </h2>

        <div className="mb-6">
          <label htmlFor="search" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
            />
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted-light dark:text-text-muted-dark" />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="category" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
            Category
          </label>
          <select
            id="category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400 appearance-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <h3 className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
            Price Range
          </h3>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-1/2 px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
            />
            <input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="w-1/2 px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
            />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="sort" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-2">
            Sort By Price
          </label>
          <select
            id="sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc' | '')}
            className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400 appearance-none"
          >
            <option value="">None</option>
            <option value="asc">Price: Low to High</option>
            <option value="desc">Price: High to Low</option>
          </select>
        </div>

        <button
          onClick={handleClearFilters}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors duration-200"
        >
          <XCircle size={20} /> Clear Filters
        </button>
      </aside>

      {/* Product list */}
      <div className="md:col-span-3">
        <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-8">
          Our Products
        </h1>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card-light dark:bg-card-dark rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark h-80"></div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 text-lg">
            Error: {error}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark text-lg">
            No products found matching your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
