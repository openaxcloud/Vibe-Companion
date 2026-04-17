import React from 'react';
import { Product } from '../utils/types';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { toast } from 'react-toastify'; // Assuming toast notifications will be implemented

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, loading: cartLoading } = useCart();

  const handleAddToCart = async () => {
    try {
      await addToCart(product, 1);
      // toast.success(`${product.name} added to cart!`);
      alert(`${product.name} added to cart!`); // Placeholder for toast
    } catch (error) {
      // toast.error('Failed to add to cart.');
      alert('Failed to add to cart.'); // Placeholder for toast
      console.error('Error adding to cart:', error);
    }
  };

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-lg overflow-hidden shadow-lg hover:shadow-xl glass-effect border border-border-light dark:border-border-dark transition-all duration-300 transform hover:-translate-y-1">
      <Link to={`/products/${product._id}`}>
        <img
          src={product.imageUrl || 'https://via.placeholder.com/400x300.png?text=Product+Image'}
          alt={product.name}
          className="w-full h-48 object-cover object-center"
        />
      </Link>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-2">
          <Link to={`/products/${product._id}`} className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200">
            {product.name}
          </Link>
        </h3>
        <p className="text-text-muted-light dark:text-text-muted-dark text-sm mb-3 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-primary-600 dark:text-primary-400">${product.price.toFixed(2)}</span>
          <button
            onClick={handleAddToCart}
            disabled={cartLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cartLoading ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            ) : (
              <ShoppingCart size={18} />
            )}
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
