import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../ui/Button';
import { apiRequest } from '../../lib/api';

interface CheckoutFormProps {
  amount: number;
  onSuccess: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded. Make sure to disable form submission until Stripe.js has loaded.
      setLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);

    if (!cardElement) {
      setError('Card details not found.');
      setLoading(false);
      return;
    }

    try {
      // 1. Create a PaymentIntent on your backend
      const { clientSecret } = await apiRequest<{ clientSecret: string }>('/payment/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({ amount: Math.round(amount * 100) }), // amount in cents
      });

      // 2. Confirm the payment on the client side
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            // Add billing details if you collect them
            // name: 'John Doe',
          },
        },
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        setError('Payment failed or was not successful.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border border-white/10 rounded-md p-4 bg-slate-800">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#e2e8f0',
                '::placeholder': { color: '#94a3b8' },
              },
              invalid: {
                color: '#ef4444',
              },
            },
          }}
        />
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      <Button type="submit" disabled={!stripe || loading} className="w-full" variant="primary" size="lg">
        {loading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </Button>
    </form>
  );
};

export default CheckoutForm;
