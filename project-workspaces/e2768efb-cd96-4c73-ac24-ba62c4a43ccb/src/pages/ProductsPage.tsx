import React, { useEffect, useState } from 'react';
import ProductCard from '../components/product/ProductCard';
import { Product } from '../types';
import { Input } from '../components/ui/Input';
import { Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate fetching products from an API
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // In a real app, this would be an API call
        const dummyProducts: Product[] = [
          { id: '1', name: 'Vintage Camera', description: 'A beautiful vintage camera, perfect for collectors.', price: 299.99, imageUrl: 'https://images.unsplash.com/photo-1520393006245-c725c56c5478?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Electronics', stock: 5 },
          { id: '2', name: 'Handcrafted Leather Wallet', description: 'Genuine leather wallet, handmade with care.', price: 75.00, imageUrl: 'https://images.unsplash.com/photo-1629810427211-cc8093557e0f?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Accessories', stock: 12 },
          { id: '3', name: 'Organic Coffee Beans', description: 'Premium fair-trade organic coffee, medium roast.', price: 18.50, imageUrl: 'https://images.unsplash.com/photo-1517721021422-0d12e44d36f9?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Food & Beverage', stock: 50 },
          { id: '4', name: 'Noise-Cancelling Headphones', description: 'Immersive sound experience with active noise cancellation.', price: 199.99, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06a244?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Electronics', stock: 8 },
          { id: '5', name: 'Designer Backpack', description: 'Stylish and durable backpack for everyday use.', price: 120.00, imageUrl: 'https://images.unsplash.com/photo-1549298453-e3871147a989?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Bags', stock: 15 },
          { id: '6', name: 'Artisan Ceramic Mug', description: 'Unique handmade mug, perfect for your morning brew.', price: 25.00, imageUrl: 'https://images.unsplash.com/photo-1563721345-0d297920cfb5?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Home Goods', stock: 30 },
        ];
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
        setProducts(dummyProducts);
      } catch (err) {
        setError('Failed to fetch products.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="h-96 flex flex-col">
            <div className="h-48 bg-slate-800 rounded-t-lg"></div>
            <div className="p-4 flex-grow space-y-3">
              <div className="h-6 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-800 rounded w-5/6"></div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="h-6 bg-slate-700 rounded w-1/4"></div>
              <div className="h-10 bg-primary-600 rounded w-1/3"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 text-xl py-10">{error}</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative w-full max-w-md mx-auto">
        <Input
          type="text"
          placeholder="Search products..."
          className="pl-10 pr-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:ring-accent-500 focus:border-accent-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
      </div>

      <h2 className="text-4xl font-bold text-white text-center mb-6">Our Products</h2>

      {filteredProducts.length === 0 ? (
        <div className="text-center text-slate-400 text-xl py-10">No products found matching your search.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProductsPage;
