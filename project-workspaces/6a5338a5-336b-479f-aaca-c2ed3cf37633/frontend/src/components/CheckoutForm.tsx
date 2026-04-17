import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { createPaymentIntent, createOrder } from '../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { cart, totalAmount, clearCart } = useCart();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState(user?.address || '');
  const [billingAddress, setBillingAddress] = useState(user?.address || '');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !token || !user) {
      toast.error('Stripe has not loaded or you are not logged in.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }
    if (!shippingAddress || !billingAddress) {
      toast.error('Please provide shipping and billing addresses.');
      return;
    }

    setLoading(true);

    try {
      // 1. Create Payment Intent on your backend
      const paymentIntentResponse = await createPaymentIntent({
        amount: Math.round(totalAmount * 100), // Amount in cents
        currency: 'usd',
        cartItems: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price }))
      }, token);
      const clientSecret = paymentIntentResponse.clientSecret;

      // 2. Confirm the payment on the client side with Stripe
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("CardElement not found.");
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: user.email,
            name: user.name,
          },
        },
      });

      if (error) {
        toast.error(error.message || 'Payment failed.');
        setLoading(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast.success('Payment successful!');
        // 3. Create the order in your backend (this could also be handled by webhook)
        // For immediate feedback, we create it here. Webhook should be robust for retries.
        await createOrder({
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
          shippingAddress,
          billingAddress,
          paymentIntentId: paymentIntent.id,
          totalAmount,
        }, token);

        clearCart();
        toast.success('Order placed successfully!');
        navigate('/dashboard'); // Redirect to order history
      } else {
        toast.error('Payment not succeeded, but no error reported.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'An unexpected error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-glass p-8 max-w-2xl mx-auto my-10 animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">Checkout</h2>

      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-white mb-4">Order Summary</h3>
        {cart.map((item) => (
          <div key={item.productId} className="flex justify-between items-center text-slate-300 py-2 border-b border-slate-800 last:border-b-0">
            <span>{item.name} (x{item.quantity})</span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex justify-between items-center text-white font-bold text-xl mt-4 pt-4 border-t border-primary-500">
          <span>Total:</span>
          <span>${totalAmount.toFixed(2)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <h3 className="text-2xl font-semibold text-white mb-4">Shipping Information</h3>
        <div>
          <label htmlFor="shippingAddress" className="block text-slate-300 text-sm font-medium mb-2">Shipping Address</label>
          <textarea
            id="shippingAddress"
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            required
            rows={3}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="Enter shipping address"
          ></textarea>
        </div>

        <h3 className="text-2xl font-semibold text-white mb-4">Billing Information</h3>
        <div>
          <label htmlFor="billingAddress" className="block text-slate-300 text-sm font-medium mb-2">Billing Address</label>
          <textarea
            id="billingAddress"
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
            required
            rows={3}
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="Enter billing address (usually same as shipping)"
          ></textarea>
        </div>

        <h3 className="text-2xl font-semibold text-white mb-4">Payment Details</h3>
        <div className="p-4 bg-slate-800 border border-slate-700 rounded-md">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#e2e8f0', // slate-200
                  '::placeholder': {
                    color: '#64748b', // slate-500
                  },
                },
                invalid: {
                  color: '#ef4444', // red-500
                },
              },
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!stripe || loading || cart.length === 0}
          className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Processing Payment...' : 'Pay Now'}
        </button>
      </form>
    </div>
  );
};

export default CheckoutForm;
