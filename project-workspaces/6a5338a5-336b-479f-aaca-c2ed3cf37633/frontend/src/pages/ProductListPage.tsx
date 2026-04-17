import React, { useState, useEffect } from 'react';
import { fetchProducts } from '../api';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import { Search, SlidersHorizontal } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

const ProductListPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const { addToCart } = useCart();

  const fetchProductsData = async () => {
    setLoading(true);
    try {
      const fetchedProducts = await fetchProducts(
        searchQuery || undefined,
        categoryFilter || undefined,
        minPrice ? parseFloat(minPrice) : undefined,
        maxPrice ? parseFloat(maxPrice) : undefined
      );
      setProducts(fetchedProducts);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsData();
  }, [searchQuery, categoryFilter, minPrice, maxPrice]);

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart({ productId: product.id, name: product.name, price: product.price, image_url: product.image_url }, quantity);
  };

  const uniqueCategories = Array.from(new Set(products.map(p => p.category))).filter(Boolean);

  return (
    <div className="py-8">
      <h1 className="text-4xl font-bold text-white text-center mb-10">Our Products</h1>

      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Search Bar */}
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Search products..."
            className="w-full p-3 pl-10 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        </div>

        {/* Filter Button for Mobile */}
        <button
          className="md:hidden flex items-center justify-center p-3 bg-primary-600 hover:bg-primary-500 text-white rounded-md transition-colors space-x-2"
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
        >
          <SlidersHorizontal className="w-5 h-5" />
          <span>Filters</span>
        </button>

        {/* Filter Panel (visible on desktop, toggle on mobile) */}
        <div className={`md:flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 ${isFilterPanelOpen ? 'block' : 'hidden'} md:block card-glass p-4 rounded-lg`}>
          <div className="flex flex-col">
            <label htmlFor="category" className="text-slate-300 text-sm font-medium mb-1">Category</label>
            <select
              id="category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-2 bg-slate-800 border border-slate-700 rounded-md text-white focus:ring-2 focus:ring-primary-500 transition-colors"
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="minPrice" className="text-slate-300 text-sm font-medium mb-1">Min Price</label>
            <input
              type="number"
              id="minPrice"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="p-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 transition-colors"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="maxPrice" className="text-slate-300 text-sm font-medium mb-1">Max Price</label>
            <input
              type="number"
              id="maxPrice"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="p-2 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 transition-colors"
              placeholder="1000"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card-glass p-4 animate-pulse flex flex-col items-center">
              <div className="w-full h-48 bg-slate-700 rounded-md mb-4"></div>
              <div className="h-6 bg-slate-700 w-3/4 mb-2 rounded"></div>
              <div className="h-4 bg-slate-700 w-1/2 mb-4 rounded"></div>
              <div className="h-8 bg-slate-700 w-full rounded-full"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
          ))}
        </div>
      )}

      {products.length === 0 && !loading && (
        <p className="text-center text-slate-400 text-lg py-10">No products found matching your criteria.</p>
      )}
    </div>
  );
};

export default ProductListPage;
