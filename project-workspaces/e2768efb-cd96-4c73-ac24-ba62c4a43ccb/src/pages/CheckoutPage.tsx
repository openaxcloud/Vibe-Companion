import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Button } from '../components/ui/Button';
import { useCart } from '../context/CartContext';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from '../components/cart/CheckoutForm'; // This component will handle Stripe payment

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY');

function CheckoutPage() {
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const totalPrice = getTotalPrice();
  const [shippingInfo, setShippingInfo] = useState({
    fullName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setShippingInfo((prev) => ({ ...prev, [id]: value }));
  };

  const handlePaymentSuccess = () => {
    // In a real application, you'd send order details to your backend,
    // clear the cart, and then navigate to an order confirmation page.
    console.log('Payment successful! Order details:', { cartItems, shippingInfo, totalPrice });
    clearCart();
    navigate('/order-confirmation'); // Redirect to a confirmation page
  };

  if (cartItems.length === 0) {
    return (
      <Card className="max-w-md mx-auto text-center p-8 animate-fade-in">
        <CardTitle className="text-3xl text-white mb-4">Your cart is empty!</CardTitle>
        <CardDescription className="text-lg text-slate-400 mb-6">
          Please add items to your cart before checking out.
        </CardDescription>
        <Button variant="primary" size="lg" onClick={() => navigate('/products')}>
          Start Shopping
        </Button>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Shipping Information</CardTitle>
          <CardDescription>Enter your shipping details</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={shippingInfo.fullName} onChange={handleInputChange} required />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={shippingInfo.address} onChange={handleInputChange} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={shippingInfo.city} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="state">State / Province</Label>
                <Input id="state" value={shippingInfo.state} onChange={handleInputChange} required />
              </div>
              <div>
                <Label htmlFor="zip">ZIP / Postal Code</Label>
                <Input id="zip" value={shippingInfo.zip} onChange={handleInputChange} required />
              </div>
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={shippingInfo.country} onChange={handleInputChange} required />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Information</CardTitle>
          <CardDescription>Complete your purchase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-slate-300">
            <h3 className="text-xl font-semibold text-white">Order Summary</h3>
            {cartItems.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.name} (x{item.quantity})</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-white/10 pt-4 text-xl font-bold text-white">
              <span>Total</span>
              <span className="text-accent-400">${totalPrice.toFixed(2)}</span>
            </div>
          </div>
          {stripePromise && (
            <Elements stripe={stripePromise}>
              <CheckoutForm amount={totalPrice} onSuccess={handlePaymentSuccess} />
            </Elements>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CheckoutPage;
