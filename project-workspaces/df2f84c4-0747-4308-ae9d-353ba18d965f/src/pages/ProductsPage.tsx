import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { api } from '../utils/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import Input from '../components/ui/Input';
import { Search } from 'lucide-react';

const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Product[]>('/products');
        if (response.success && response.data) {
          setProducts(response.data);
        } else {
          setError(response.message || 'Failed to fetch products');
        }
      } catch (err) {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const uniqueCategories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  if (loading) {
    return (
      <div className="text-center text-xl text-slate-300 animate-pulse">Loading products...</div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 text-xl">{error}</div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-8 text-white">Our Products</h1>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <Input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200"
        >
          {uniqueCategories.map((category) => (
            <option key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="flex flex-col animate-fade-in hover:scale-[1.02] transform transition-transform duration-200">
            <Link to={`/products/${product.id}`}>
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-t-lg mb-4 transform hover:scale-105 transition-transform duration-300"
              />
            </Link>
            <h2 className="text-xl font-semibold text-white mb-2">{product.name}</h2>
            <p className="text-slate-400 text-sm mb-3 line-clamp-2">{product.description}</p>
            <div className="flex justify-between items-center mt-auto">
              <span className="text-2xl font-bold text-accent">${product.price.toFixed(2)}</span>
              <Button onClick={() => handleAddToCart(product)} variant="primary">
                Add to Cart
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {filteredProducts.length === 0 && (
        <div className="text-center text-slate-400 text-lg mt-8">No products found matching your criteria.</div>
      )}
    </div>
  );
};

export default ProductsPage;