import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Product } from '../utils/types';
import * as productService from '../services/productService';
import { ShoppingCart, Star, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addToCart, loading: cartLoading } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        if (id) {
          const data = await productService.getProductById(id);
          setProduct(data);
        }
      } catch (err) {
        setError('Failed to fetch product.');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (product) {
      try {
        await addToCart(product, quantity);
        alert(`${quantity} of ${product.name} added to cart!`); // Placeholder
      } catch (error) {
        alert('Failed to add to cart.'); // Placeholder
        console.error('Error adding to cart:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8 py-12 animate-pulse">
        <div className="md:w-1/2 h-96 bg-card-dark rounded-lg"></div>
        <div className="md:w-1/2 space-y-4">
          <div className="h-8 bg-card-dark rounded w-3/4"></div>
          <div className="h-6 bg-card-dark rounded w-1/4"></div>
          <div className="h-4 bg-card-dark rounded w-full"></div>
          <div className="h-4 bg-card-dark rounded w-5/6"></div>
          <div className="h-12 bg-card-dark rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12 text-red-500 text-lg">
        Error: {error || 'Product not found.'}
      </div>
    );
  }

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark p-8 md:p-12">
      <div className="flex flex-col md:flex-row gap-8 md:gap-12">
        <div className="md:w-1/2">
          <img
            src={product.imageUrl || 'https://via.placeholder.com/600x400.png?text=Product+Image'}
            alt={product.name}
            className="w-full h-96 object-contain rounded-lg shadow-md"
          />
        </div>
        <div className="md:w-1/2 flex flex-col justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-2">
              {product.name}
            </h1>
            <p className="text-primary-600 dark:text-primary-400 text-2xl font-bold mb-4">
              ${product.price.toFixed(2)}
            </p>
            <div className="flex items-center gap-1 mb-4 text-yellow-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={20} fill="currentColor" strokeWidth={0} />
              ))} <span className="ml-2 text-text-muted-light dark:text-text-muted-dark text-sm">(4.5 Stars)</span>
            </div>
            <p className="text-text-muted-light dark:text-text-muted-dark leading-relaxed mb-6">
              {product.description}
            </p>
            <div className="mb-6">
              <span className="font-semibold text-text-light dark:text-text-dark">Category: </span>
              <span className="text-text-muted-light dark:text-text-muted-dark">{product.category}</span>
            </div>
            <div className="mb-6">
              <span className="font-semibold text-text-light dark:text-text-dark">Availability: </span>
              {product.stock > 0 ? (
                <span className="text-emerald-500 font-medium">In Stock ({product.stock})</span>
              ) : (
                <span className="text-red-500 font-medium">Out of Stock</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-8">
            <div className="flex items-center border border-border-light dark:border-border-dark rounded-md">
              <button
                onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                className="p-2 text-text-light dark:text-text-dark hover:bg-primary-100 dark:hover:bg-primary-900 rounded-l-md transition-colors duration-200"
                disabled={quantity <= 1 || product.stock === 0}
              >
                <Minus size={20} />
              </button>
              <span className="px-4 py-2 text-text-light dark:text-text-dark font-medium border-x border-border-light dark:border-border-dark">{quantity}</span>
              <button
                onClick={() => setQuantity(prev => Math.min(product.stock, prev + 1))}
                className="p-2 text-text-light dark:text-text-dark hover:bg-primary-100 dark:hover:bg-primary-900 rounded-r-md transition-colors duration-200"
                disabled={quantity >= product.stock || product.stock === 0}
              >
                <Plus size={20} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0 || cartLoading}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cartLoading ? (
                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <ShoppingCart size={20} />
              )}
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
