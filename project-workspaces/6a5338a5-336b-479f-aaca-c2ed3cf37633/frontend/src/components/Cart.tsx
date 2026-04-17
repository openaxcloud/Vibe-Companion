import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { XCircle, MinusCircle, PlusCircle } from 'lucide-react';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, totalAmount, clearCart } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (cart.length === 0) {
      // Optionally, show a toast or message that cart is empty
      return;
    }
    navigate('/checkout');
  };

  return (
    <div className="card-glass p-6 my-8">
      <h2 className="text-3xl font-bold text-white mb-6 border-b border-slate-700 pb-4">Your Shopping Cart</h2>

      {cart.length === 0 ? (
        <p className="text-slate-400 text-center text-lg py-10">Your cart is empty. <Link to="/products" className="text-primary-400 hover:underline">Start shopping!</Link></p>
      ) : (
        <div className="space-y-6">
          {cart.map((item) => (
            <div key={item.productId} className="flex items-center justify-between border-b border-slate-800 pb-4 last:border-b-0">
              <div className="flex items-center space-x-4">
                <img src={item.image_url || 'https://via.placeholder.com/100x100.png?text=Product'}
                     alt={item.name} className="w-20 h-20 object-cover rounded-md" />
                <div>
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="text-primary-300">${item.price.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-slate-800 rounded-md p-1">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                  >
                    <MinusCircle className="w-5 h-5" />
                  </button>
                  <span className="text-white font-medium text-lg">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="text-slate-400 hover:text-white transition-colors p-1"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                  title="Remove Item"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-6 border-t border-slate-700 mt-6">
            <p className="text-xl font-bold text-white">Total:</p>
            <p className="text-3xl font-bold text-secondary-400">${totalAmount.toFixed(2)}</p>
          </div>

          <div className="flex flex-col md:flex-row justify-end space-y-4 md:space-y-0 md:space-x-4 mt-8">
            <button
              onClick={clearCart}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-md transition-all duration-200"
            >
              Clear Cart
            </button>
            <button
              onClick={handleCheckout}
              className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-6 rounded-md transition-all duration-200"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
