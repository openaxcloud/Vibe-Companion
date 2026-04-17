import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchProductById } from '../api';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import { ShoppingCart, MinusCircle, PlusCircle } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
}

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();

  useEffect(() => {
    const getProduct = async () => {
      if (!id) return;
      try {
        const fetchedProduct = await fetchProductById(id);
        setProduct(fetchedProduct);
      } catch (error: any) {
        toast.error(error.message || 'Failed to fetch product details');
      } finally {
        setLoading(false);
      }
    };
    getProduct();
  }, [id]);

  const handleAddToCart = () => {
    if (product) {
      if (product.stock === 0) {
        toast.error('This product is out of stock.');
        return;
      }
      if (quantity > product.stock) {
        toast.error(`Cannot add more than ${product.stock} items to cart. Current stock is ${product.stock}.`);
        setQuantity(product.stock); // Adjust quantity to max available stock
        return;
      }
      addToCart({ productId: product.id, name: product.name, price: product.price, image_url: product.image_url }, quantity);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-pulse card-glass p-8 flex flex-col md:flex-row gap-8 w-full max-w-4xl">
          <div className="flex-shrink-0 w-full md:w-1/2 h-80 bg-slate-700 rounded-lg"></div>
          <div className="flex-grow space-y-4">
            <div className="h-8 bg-slate-700 w-3/4 rounded"></div>
            <div className="h-6 bg-slate-700 w-1/2 rounded"></div>
            <div className="h-4 bg-slate-700 w-full rounded"></div>
            <div className="h-4 bg-slate-700 w-5/6 rounded"></div>
            <div className="h-4 bg-slate-700 w-2/3 rounded"></div>
            <div className="h-10 bg-slate-700 w-1/3 rounded-full mt-6"></div>
            <div className="h-12 bg-slate-700 w-full rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return <div className="text-center text-red-400 text-xl py-20">Product not found.</div>;
  }

  const imageUrl = product.image_url || 'https://via.placeholder.com/600x400.png?text=No+Image';

  return (
    <div className="card-glass p-8 my-10 flex flex-col md:flex-row gap-8 animate-fade-in max-w-5xl mx-auto">
      <div className="flex-shrink-0 md:w-1/2">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-96 object-cover rounded-lg shadow-lg"
        />
      </div>
      <div className="flex-grow">
        <h1 className="text-4xl font-bold text-white mb-4">{product.name}</h1>
        <p className="text-2xl font-semibold text-primary-400 mb-6">${product.price.toFixed(2)}</p>
        <p className="text-slate-300 leading-relaxed mb-8">{product.description}</p>

        <div className="flex items-center space-x-4 mb-8">
          <span className="text-lg font-medium text-slate-200">Quantity:</span>
          <div className="flex items-center space-x-2 bg-slate-800 rounded-md p-1">
            <button
              onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <MinusCircle className="w-6 h-6" />
            </button>
            <span className="text-white font-medium text-xl">{quantity}</span>
            <button
              onClick={() => setQuantity(prev => (product.stock > 0 && prev < product.stock) ? prev + 1 : prev)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <PlusCircle className="w-6 h-6" />
            </button>
          </div>
          <span className="text-sm text-slate-500">({product.stock} in stock)</span>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0 || quantity > product.stock}
          className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-md transition-all duration-300 flex items-center justify-center space-x-3 text-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-6 h-6" />
          <span>{product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
        </button>
      </div>
    </div>
  );
};

export default ProductDetailPage;
