import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../hooks/useAuth';
import { api } from '../utils/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK_KEY as string);

const CheckoutPage: React.FC = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('stripe'); // Only Stripe for now
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!user || !token) {
      setError('You must be logged in to checkout.');
      setLoading(false);
      return;
    }

    if (cart.length === 0) {
      setError('Your cart is empty.');
      setLoading(false);
      return;
    }

    if (!stripePromise) {
      setError('Stripe is not initialized. Please try again later.');
      setLoading(false);
      return;
    }

    try {
      // 1. Create a checkout session on your backend
      const checkoutResponse = await api.post<{ sessionId: string }>(
        '/stripe/create-checkout-session',
        {
          items: cart.map(item => ({
            productId: item.id,
            name: item.name,
            imageUrl: item.imageUrl,
            price: item.price,
            quantity: item.quantity,
          })),
          shippingAddress,
        },
        token
      );

      if (checkoutResponse.success && checkoutResponse.data) {
        const stripe = await stripePromise;
        if (!stripe) {
            setError('Stripe is not available.');
            setLoading(false);
            return;
        }
        const { error: stripeError } = await stripe.redirectToCheckout({
          sessionId: checkoutResponse.data.sessionId,
        });

        if (stripeError) {
          setError(stripeError.message || 'Error redirecting to Stripe checkout.');
        }
      } else {
        setError(checkoutResponse.message || 'Failed to create checkout session.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError('An unexpected error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-4xl font-bold mb-8 text-white">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="flex flex-col gap-6 animate-slide-up">
          <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-4">Shipping Information</h2>
          <Input
            label="Address"
            type="text"
            name="address"
            value={shippingAddress.address}
            onChange={handleInputChange}
            required
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="City"
              type="text"
              name="city"
              value={shippingAddress.city}
              onChange={handleInputChange}
              required
            />
            <Input
              label="State/Province"
              type="text"
              name="state"
              value={shippingAddress.state}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Zip/Postal Code"
              type="text"
              name="zip"
              value={shippingAddress.zip}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Country"
              type="text"
              name="country"
              value={shippingAddress.country}
              onChange={handleInputChange}
              required
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-6 animate-fade-in">
          <h2 className="text-2xl font-bold text-white border-b border-slate-700 pb-4">Order Summary</h2>
          <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
            {cart.map((item) => (
              <li key={item.id} className="flex justify-between text-slate-300 text-sm">
                <span>{item.name} (x{item.quantity})</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-lg text-slate-300 pt-4 border-t border-slate-800">
            <span>Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xl font-bold text-white">
            <span>Total</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>

          <h3 className="text-xl font-bold text-white border-b border-slate-700 pb-3 pt-4">Payment Method</h3>
          <div className="flex items-center gap-2">
            <Input
              type="radio"
              id="stripePayment"
              name="paymentMethod"
              value="stripe"
              checked={paymentMethod === 'stripe'}
              onChange={() => setPaymentMethod('stripe')}
              className="w-4 h-4 text-primary bg-slate-700 border-slate-600 focus:ring-primary"
            />
            <label htmlFor="stripePayment" className="text-slate-300">Stripe</label>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={loading || cart.length === 0}>
            {loading ? 'Processing...' : `Pay $${cartTotal.toFixed(2)}`}
          </Button>
          <p className="text-xs text-slate-500 text-center">
            By placing your order, you agree to our terms and conditions.
          </p>
        </Card>
      </form>
    </div>
  );
};

export default CheckoutPage;