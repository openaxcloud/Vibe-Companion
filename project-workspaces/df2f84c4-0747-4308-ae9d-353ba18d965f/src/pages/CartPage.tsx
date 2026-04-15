import React from 'react';
import { useCart } from '../context/CartContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';

const CartPage: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal } = useCart();

  if (cart.length === 0) {
    return (
      <div className="text-center p-8 animate-fade-in">
        <h1 className="text-4xl font-bold text-white mb-4">Your Cart is Empty</h1>
        <p className="text-lg text-slate-400 mb-8">Looks like you haven't added anything to your cart yet.</p>
        <Button asChild>
          <Link to="/products">Start Shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-8 text-white">Your Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <Card key={item.id} className="flex items-center gap-4 animate-slide-up p-4">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-24 h-24 object-cover rounded-md"
              />
              <div className="flex-grow">
                <Link to={`/products/${item.id}`} className="text-xl font-semibold text-white hover:text-primary transition-colors">
                  {item.name}
                </Link>
                <p className="text-slate-400">${item.price.toFixed(2)}</p>
                <div className="flex items-center mt-2 gap-4">
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                    className="w-20 text-center bg-slate-700 border-slate-600"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeFromCart(item.id)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 size={16} /> Remove
                  </Button>
                </div>
              </div>
              <div className="text-2xl font-bold text-accent">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
            </Card>
          ))}
        </div>

        <Card className="lg:col-span-1 p-6 flex flex-col gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-4">Order Summary</h2>
          <div className="flex justify-between text-lg text-slate-300">
            <span>Subtotal ({cart.length} items)</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-white">
            <span>Total</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <Button asChild variant="primary" size="lg">
            <Link to="/checkout">Proceed to Checkout</Link>
          </Button>
          <Button variant="outline" onClick={clearCart} className="w-full">
            Clear Cart
          </Button>
        </Card>
      </div>
    </div>
  );
};

export default CartPage;