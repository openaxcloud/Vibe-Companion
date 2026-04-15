import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product } from '../types';
import { Button } from '../components/ui/Button';
import { ShoppingCart, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { useCart } from '../context/CartContext';

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItemToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        // Simulate API call for a single product
        const dummyProducts: Product[] = [
          { id: '1', name: 'Vintage Camera', description: 'A beautiful vintage camera, perfect for collectors. Captures stunning photos with a classic feel. Features include a manual focus lens, adjustable aperture, and a sturdy body construction. Comes with a leather strap.', price: 299.99, imageUrl: 'https://images.unsplash.com/photo-1520393006245-c725c56c5478?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Electronics', stock: 5 },
          { id: '2', name: 'Handcrafted Leather Wallet', description: 'Genuine leather wallet, handmade with care. Features multiple card slots, a bill compartment, and a coin pocket. Ages beautifully with use.', price: 75.00, imageUrl: 'https://images.unsplash.com/photo-1629810427211-cc8093557e0f?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Accessories', stock: 12 },
          { id: '3', name: 'Organic Coffee Beans', description: 'Premium fair-trade organic coffee, medium roast. Sourced from sustainable farms in Ethiopia, offering rich aroma and a smooth finish. Perfect for espresso or drip coffee.', price: 18.50, imageUrl: 'https://images.unsplash.com/photo-1517721021422-0d12e44d36f9?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Food & Beverage', stock: 50 },
          { id: '4', name: 'Noise-Cancelling Headphones', description: 'Immersive sound experience with active noise cancellation. Enjoy your music without distractions. Comfortable earcups and long battery life.', price: 199.99, imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06a244?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', category: 'Electronics', stock: 8 },
        ];
        await new Promise(resolve => setTimeout(resolve, 500));
        const foundProduct = dummyProducts.find(p => p.id === id);
        if (foundProduct) {
          setProduct(foundProduct);
        } else {
          setError('Product not found.');
        }
      } catch (err) {
        setError('Failed to fetch product details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addItemToCart(product, quantity);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
        <div className="bg-slate-800 rounded-lg h-96"></div>
        <div className="space-y-6">
          <div className="h-10 bg-slate-700 rounded w-3/4"></div>
          <div className="h-6 bg-slate-800 rounded w-1/2"></div>
          <div className="h-24 bg-slate-800 rounded"></div>
          <div className="h-8 bg-slate-700 rounded w-1/4"></div>
          <div className="flex space-x-4">
            <div className="h-10 w-24 bg-slate-700 rounded"></div>
            <div className="h-10 w-40 bg-primary-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 text-xl py-10">{error}</div>;
  }

  if (!product) {
    return <div className="text-center text-slate-400 text-xl py-10">Product not found.</div>;
  }

  return (
    <div className="animate-fade-in">
      <Link to="/products" className="inline-flex items-center text-primary-400 hover:text-primary-300 transition-colors mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to Products
      </Link>

      <Card className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        <div className="flex justify-center items-center bg-slate-800 rounded-lg overflow-hidden">
          <img
            src={product.imageUrl || 'https://via.placeholder.com/600x400.png?text=Product+Image'}
            alt={product.name}
            className="max-h-[500px] w-full object-contain"
          />
        </div>

        <div className="space-y-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-4xl font-bold text-white leading-tight">{product.name}</CardTitle>
            <CardDescription className="text-lg text-slate-400">{product.category}</CardDescription>
          </CardHeader>

          <CardContent className="p-0 space-y-4">
            <p className="text-3xl font-extrabold text-accent-400">${product.price.toFixed(2)}</p>
            <p className="text-slate-300 leading-relaxed text-lg">{product.description}</p>

            <div className="flex items-center space-x-4">
              <span className="text-lg font-medium text-slate-300">Quantity:</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-xl font-bold text-white">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(prev => prev + 1)}
                disabled={quantity >= product.stock}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {product.stock <= 10 && product.stock > 0 && (
                <span className="text-orange-400 text-sm">Only {product.stock} left!</span>
              )}
              {product.stock === 0 && (
                <span className="text-red-500 text-sm">Out of Stock</span>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto mt-4"
              onClick={handleAddToCart}
              disabled={product.stock === 0}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Add to Cart
            </Button>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

export default ProductDetailPage;
