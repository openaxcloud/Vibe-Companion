import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { useCart } from '../context/CartContext';
import CartItem from '../components/cart/CartItem';
import { ShoppingCart, ArrowLeft } from 'lucide-react';

function CartPage() {
  const { cartItems, getTotalPrice } = useCart();
  const totalPrice = getTotalPrice();

  return (
    <div className="animate-fade-in">
      <h1 className="text-4xl font-bold text-white mb-8 text-center">Your Shopping Cart</h1>

      {cartItems.length === 0 ? (
        <Card className="max-w-xl mx-auto text-center p-8">
          <ShoppingCart className="h-20 w-20 text-slate-400 mx-auto mb-6" />
          <CardTitle className="text-3xl text-white mb-4">Your cart is empty!</CardTitle>
          <CardDescription className="text-lg text-slate-400 mb-6">
            Looks like you haven't added anything to your cart yet. Start shopping to fill it up.
          </CardDescription>
          <Link to="/products">
            <Button variant="primary" size="lg">
              Start Shopping
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                {cartItems.map((item) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </CardContent>
            </Card>
            <Link to="/products" className="inline-flex items-center text-primary-400 hover:text-primary-300 transition-colors">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Continue Shopping
            </Link>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6">
              <CardTitle className="text-2xl font-bold text-white mb-4">Order Summary</CardTitle>
              <div className="space-y-3 text-slate-300 mb-6">
                <div className="flex justify-between items-center text-lg">
                  <span>Subtotal</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span>Shipping</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/10 pt-4 text-xl font-bold text-white">
                  <span>Total</span>
                  <span className="text-accent-400">${totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <Link to="/checkout">
                <Button variant="primary" size="lg" className="w-full">
                  Proceed to Checkout
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartPage;
