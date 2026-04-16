import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import CartItem from '../components/CartItem';
import { ShoppingCart, ArrowRight } from 'lucide-react';

const CartPage: React.FC = () => {
  const { cartItems, getTotalPrice } = useCart();
  const totalPrice = getTotalPrice();

  return (
    <div className="py-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-primary-400 mb-8 text-center">Your Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <div className="text-center card-glass p-10 max-w-xl mx-auto flex flex-col items-center">
          <ShoppingCart size={64} className="text-slate-500 mb-6" />
          <p className="text-xl text-slate-300 mb-6">Your cart is empty.</p>
          <Link
            to="/products"
            className="bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 ease-out hover:scale-105 flex items-center gap-2"
          >
            Start Shopping <ArrowRight size={20} />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <CartItem key={item.product.id} item={item} />
            ))}
          </div>
          <div className="lg:col-span-1 card-glass p-6 sticky top-28 h-fit">
            <h2 className="text-2xl font-bold text-slate-50 mb-4">Order Summary</h2>
            <div className="flex justify-between text-lg text-slate-300 mb-2">
              <span>Subtotal:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg text-slate-300 mb-2">
              <span>Shipping:</span>
              <span>Free</span>
            </div>
            <div className="border-t border-slate-700 my-4"></div>
            <div className="flex justify-between text-2xl font-bold text-primary-400">
              <span>Total:</span>
              <span>${totalPrice.toFixed(2)}</span>
            </div>
            <Link
              to="/checkout"
              className="mt-6 w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg shadow-xl transform transition-all duration-300 ease-out hover:scale-105 flex items-center justify-center gap-2"
            >
              Proceed to Checkout <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;