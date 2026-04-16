import React from 'react';
import { CartItem as TCartItem } from '../types';
import { useCart } from '../hooks/useCart';
import { Plus, Minus, X } from 'lucide-react';

interface CartItemProps {
  item: TCartItem;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateItemQuantity, removeItemFromCart } = useCart();

  return (
    <div className="card-glass p-4 flex items-center space-x-4 animate-slide-up">
      <img
        src={item.product.imageUrl || 'https://via.placeholder.com/80x80?text=Product'}
        alt={item.product.name}
        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
      />
      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-slate-50">{item.product.name}</h3>
        <p className="text-slate-400">${item.product.price.toFixed(2)}</p>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
          className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors duration-200"
          aria-label="Decrease quantity"
        >
          <Minus size={16} />
        </button>
        <span className="text-lg font-medium text-slate-100 w-8 text-center">{item.quantity}</span>
        <button
          onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
          className="p-2 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors duration-200"
          aria-label="Increase quantity"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="text-xl font-semibold text-primary-400 w-24 text-right hidden sm:block">
        ${(item.product.price * item.quantity).toFixed(2)}
      </div>
      <button
        onClick={() => removeItemFromCart(item.product.id)}
        className="p-2 rounded-full text-red-400 hover:bg-red-500/20 transition-colors duration-200 ml-4"
        aria-label="Remove item"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default CartItem;