import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Product } from '../types';
import * as productApi from '../api/products';
import { useCart } from '../hooks/useCart';
import LoadingSpinner from '../components/LoadingSpinner';
import { toast } from '../components/Toast';

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { addItemToCart } = useCart();
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError(null);
      try {
        if (id) {
          const fetchedProduct = await productApi.getProductById(id);
          setProduct(fetchedProduct);
        }
      } catch (err) {
        setError('Failed to fetch product details.');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      addItemToCart(product, quantity);
      toast.success(`${quantity} x ${product.name} added to cart!`);
    }
  };

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

  if (!product) {
    return <div className="text-center text-slate-400 text-xl mt-10">Product not found.</div>;
  }

  return (
    <div className="animate-fade-in py-8">
      <div className="card-glass flex flex-col md:flex-row gap-8 p-8 items-center">
        <div className="md:w-1/2 flex justify-center">
          <img
            src={product.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image'}
            alt={product.name}
            className="rounded-lg shadow-lg object-cover w-full h-96 md:h-auto max-w-md"
          />
        </div>
        <div className="md:w-1/2">
          <h1 className="text-4xl font-extrabold text-primary-400 mb-4">{product.name}</h1>
          <p className="text-slate-300 text-lg mb-6 leading-relaxed">
            {product.description}
          </p>
          <div className="flex items-center mb-6">
            <span className="text-5xl font-bold text-accent-400 mr-4">${product.price.toFixed(2)}</span>
            <span className="text-lg text-slate-400">In Stock: {product.inventory}</span>
          </div>

          <div className="flex items-center space-x-4 mb-8">
            <label htmlFor="quantity" className="text-lg text-slate-200">Quantity:</label>
            <input
              type="number"
              id="quantity"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value)))}
              className="w-20 p-2 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <button
            onClick={handleAddToCart}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-lg shadow-xl transform transition-all duration-300 ease-out hover:scale-105"
            disabled={product.inventory === 0}
          >
            {product.inventory === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;