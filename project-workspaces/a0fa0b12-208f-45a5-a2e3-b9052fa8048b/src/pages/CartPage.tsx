import React from 'react';
import { useCart } from '../context/CartContext';
import CartItem from '../components/CartItem';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';

const CartPage: React.FC = () => {
  const { cart, totalItems, totalPrice, loading: cartLoading, clearCart } = useCart();
  const navigate = useNavigate();

  const handleClearCart = async () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      await clearCart();
      alert('Cart cleared!'); // Placeholder
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-6">
        Your Shopping Cart
      </h1>

      {cartLoading ? (
        <div className="text-center py-12 text-text-muted-light dark:text-text-muted-dark">
          Loading cart...
        </div>
      ) : totalItems === 0 ? (
        <div className="bg-card-light dark:bg-card-dark glass-effect border border-border-light dark:border-border-dark rounded-lg p-8 text-center">
          <ShoppingCart size={64} className="text-primary-500 mx-auto mb-4" />
          <p className="text-xl text-text-muted-light dark:text-text-muted-dark mb-4">
            Your cart is empty.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200"
          >
            Start Shopping <ArrowRight className="ml-2" size={18} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.map((item) => (
              <CartItem key={item._id || item.product._id} item={item} />
            ))}
            <button
              onClick={handleClearCart}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
              disabled={cartLoading}
            >
              Clear Cart
            </button>
          </div>

          <div className="lg:col-span-1 bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark h-fit">
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">Order Summary</h2>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-text-light dark:text-text-dark">
                <span>Items ({totalItems})</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-light dark:text-text-dark">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-primary-600 dark:text-primary-400 border-t border-border-light dark:border-border-dark pt-4 mt-4">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/checkout')}
              disabled={cartLoading || totalItems === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proceed to Checkout <ArrowRight className="ml-2" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
