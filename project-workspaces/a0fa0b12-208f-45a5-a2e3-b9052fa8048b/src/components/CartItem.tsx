import React from 'react';
import { CartItem as TCartItem } from '../utils/types';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useCart } from '../context/CartContext';
// import { toast } from 'react-toastify'; // Assuming toast notifications

interface CartItemProps {
  item: TCartItem;
}

const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { removeFromCart, updateCartItemQuantity, loading } = useCart();

  const handleRemove = async () => {
    try {
      await removeFromCart(item.product._id);
      // toast.success(`${item.product.name} removed from cart.`);
      alert(`${item.product.name} removed from cart.`); // Placeholder
    } catch (error) {
      // toast.error('Failed to remove item.');
      alert('Failed to remove item.'); // Placeholder
      console.error('Error removing item:', error);
    }
  };

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await updateCartItemQuantity(item.product._id, newQuantity);
      // toast.success(`Quantity for ${item.product.name} updated.`);
    } catch (error) {
      // toast.error('Failed to update quantity.');
      alert('Failed to update quantity.'); // Placeholder
      console.error('Error updating quantity:', error);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-card-light dark:bg-card-dark p-4 rounded-lg shadow-sm border border-border-light dark:border-border-dark glass-effect">
      <img
        src={item.product.imageUrl || 'https://via.placeholder.com/100x100.png?text=Product'}
        alt={item.product.name}
        className="w-20 h-20 object-cover rounded-md"
      />
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-text-light dark:text-text-dark">
          {item.product.name}
        </h3>
        <p className="text-text-muted-light dark:text-text-muted-dark text-sm">
          ${item.product.price.toFixed(2)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleQuantityChange(item.quantity - 1)}
          disabled={loading || item.quantity <= 1}
          className="p-1 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center font-medium text-text-light dark:text-text-dark">{item.quantity}</span>
        <button
          onClick={() => handleQuantityChange(item.quantity + 1)}
          disabled={loading}
          className="p-1 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">
        ${(item.product.price * item.quantity).toFixed(2)}
      </div>
      <button
        onClick={handleRemove}
        disabled={loading}
        className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
};

export default CartItem;
