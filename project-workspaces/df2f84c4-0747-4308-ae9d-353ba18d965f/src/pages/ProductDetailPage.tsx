import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { api } from '../utils/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useCart } from '../context/CartContext';
import { ArrowLeft } from 'lucide-react';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<Product>(`/products/${id}`);
        if (response.success && response.data) {
          setProduct(response.data);
        } else {
          setError(response.message || 'Product not found');
        }
      } catch (err) {
        setError('An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addToCart(product, quantity);
      navigate('/cart');
    }
  };

  if (loading) {
    return <div className="text-center text-xl text-slate-300 animate-pulse">Loading product details...</div>;
  }

  if (error || !product) {
    return <div className="text-center text-red-500 text-xl">{error || 'Product not found.'}</div>;
  }

  return (
    <div className="p-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 text-slate-300 hover:text-white">
        <ArrowLeft size={20} /> Back to Products
      </Button>

      <Card className="flex flex-col lg:flex-row gap-8 animate-slide-up">
        <div className="lg:w-1/2">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-96 object-cover rounded-lg shadow-md"
          />
        </div>
        <div className="lg:w-1/2 flex flex-col justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{product.name}</h1>
            <p className="text-slate-400 text-lg mb-4">{product.description}</p>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-5xl font-extrabold text-accent">${product.price.toFixed(2)}</span>
              <span className="text-slate-500">|</span>
              <span className="text-lg text-slate-300">In Stock: {product.stock}</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <Input
                id="quantity"
                type="number"
                min="1"
                max={product.stock}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="w-24 text-center"
              />
              <Button onClick={handleAddToCart} variant="primary" disabled={product.stock === 0}>
                {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProductDetailPage;