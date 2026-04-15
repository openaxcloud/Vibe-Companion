import React from 'react';
import { CartProduct } from '../../types';
import { Button } from '../ui/Button';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface CartItemProps {
  item: CartProduct;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateItemQuantity, removeItemFromCart } = useCart();

  return (
    <div className="flex items-center border-b border-white/10 py-4 last:border-b-0 animate-slide-up">
      <img
        src={item.imageUrl || 'https://via.placeholder.com/100x100.png?text=Product'}
        alt={item.name}
        className="h-24 w-24 object-cover rounded-md mr-4 flex-shrink-0"
      />
      <div className="flex-grow">
        <h3 className="text-lg font-semibold text-white">{item.name}</h3>
        <p className="text-slate-400 text-sm">${item.price.toFixed(2)}</p>
      </div>
      <div className="flex items-center space-x-2 mx-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
          disabled={item.quantity <= 1}
        >
          <Minus className="h-4 w-4 text-slate-300" />
        </Button>
        <span className="text-lg font-medium text-white w-8 text-center">{item.quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
        >
          <Plus className="h-4 w-4 text-slate-300" />
        </Button>
      </div>
      <div className="text-lg font-bold text-accent-400 w-24 text-right">
        ${(item.price * item.quantity).toFixed(2)}
      </div>
      <Button
        variant="destructive"
        size="icon"
        className="ml-4 flex-shrink-0"
        onClick={() => removeItemFromCart(item.id)}
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default CartItem;
