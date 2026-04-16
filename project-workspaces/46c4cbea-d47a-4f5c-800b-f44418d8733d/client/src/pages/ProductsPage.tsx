import React, { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import { Product } from '../types';
import * as productApi from '../api/products';
import LoadingSpinner from '../components/LoadingSpinner';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<{ category: string; priceRange: [number, number] }>({
    category: 'All',
    priceRange: [0, 1000], // Example range
  });

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // In a real app, you'd pass searchTerm and filters to the API
        const fetchedProducts = await productApi.getProducts();
        setProducts(fetchedProducts);
      } catch (err) {
        setError('Failed to fetch products. Please try again later.');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchTerm, filters]); // Re-fetch when search or filters change

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleFilterChange = (newFilters: { category: string; priceRange: [number, number] }) => {
    setFilters(newFilters);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filters.category === 'All' || product.category === filters.category;
    const matchesPrice = product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1];
    return matchesSearch && matchesCategory && matchesPrice;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 text-xl mt-10">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 py-8 animate-fade-in">
      <FilterSidebar onFilterChange={handleFilterChange} currentFilters={filters} />
      <div className="flex-grow">
        <SearchBar onSearch={handleSearch} initialSearchTerm={searchTerm} />
        <h2 className="text-3xl font-bold text-slate-50 mb-6 mt-8">Products</h2>
        {filteredProducts.length === 0 ? (
          <p className="text-slate-400 text-lg">No products found matching your criteria.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;