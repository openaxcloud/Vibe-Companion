import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { loadStripe } from '@stripe/stripe-js';
import * as orderService from '../services/orderService';
import { ShippingAddress, BillingAddress } from '../utils/types';
import { CreditCard, CheckCircle, Loader2 } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, totalPrice, clearCart } = useCart();
  const { isAuthenticated, user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    fullName: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  });
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBillingAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPaymentError(null);

    if (!isAuthenticated()) {
      setPaymentError('Please log in to complete your order.');
      setLoading(false);
      return;
    }

    if (cart.length === 0) {
      setPaymentError('Your cart is empty. Please add items before checking out.');
      setLoading(false);
      return;
    }

    try {
      const orderData = {
        items: cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
        shippingAddress: shippingAddress,
        billingAddress: useSameAddress ? shippingAddress : billingAddress,
        totalAmount: totalPrice,
      };

      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load.');

      const response = await orderService.createOrder(token!, orderData);
      const { sessionId } = response;

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        setPaymentError(error.message || 'Failed to redirect to Stripe Checkout.');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      setPaymentError(error.response?.data?.message || error.message || 'An unexpected error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-extrabold text-text-light dark:text-text-dark mb-6">
        Checkout
      </h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shipping Address */}
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">Shipping Information</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Full Name</label>
              <input type="text" id="fullName" name="fullName" value={shippingAddress.fullName} onChange={handleShippingChange} required
                className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
            </div>
            <div>
              <label htmlFor="addressLine1" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Address Line 1</label>
              <input type="text" id="addressLine1" name="addressLine1" value={shippingAddress.addressLine1} onChange={handleShippingChange} required
                className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
            </div>
            <div>
              <label htmlFor="addressLine2" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Address Line 2 (Optional)</label>
              <input type="text" id="addressLine2" name="addressLine2" value={shippingAddress.addressLine2} onChange={handleShippingChange}
                className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">City</label>
                <input type="text" id="city" name="city" value={shippingAddress.city} onChange={handleShippingChange} required
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">State/Province</label>
                <input type="text" id="state" name="state" value={shippingAddress.state} onChange={handleShippingChange} required
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Postal Code</label>
                <input type="text" id="postalCode" name="postalCode" value={shippingAddress.postalCode} onChange={handleShippingChange} required
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Country</label>
                <input type="text" id="country" name="country" value={shippingAddress.country} onChange={handleShippingChange} required
                  className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Billing Address & Order Summary */}
        <div className="space-y-8">
          <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">Billing Information</h2>
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="useSameAddress"
                checked={useSameAddress}
                onChange={(e) => setUseSameAddress(e.target.checked)}
                className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-border-light dark:border-border-dark rounded"
              />
              <label htmlFor="useSameAddress" className="text-sm font-medium text-text-muted-light dark:text-text-muted-dark">
                Same as shipping address
              </label>
            </div>

            {!useSameAddress && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="billingFullName" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Full Name</label>
                  <input type="text" id="billingFullName" name="fullName" value={billingAddress.fullName} onChange={handleBillingChange} required={!useSameAddress}
                    className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                </div>
                <div>
                  <label htmlFor="billingAddressLine1" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Address Line 1</label>
                  <input type="text" id="billingAddressLine1" name="addressLine1" value={billingAddress.addressLine1} onChange={handleBillingChange} required={!useSameAddress}
                    className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="billingCity" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">City</label>
                    <input type="text" id="billingCity" name="city" value={billingAddress.city} onChange={handleBillingChange} required={!useSameAddress}
                      className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                  </div>
                  <div>
                    <label htmlFor="billingState" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">State/Province</label>
                    <input type="text" id="billingState" name="state" value={billingAddress.state} onChange={handleBillingChange} required={!useSameAddress}
                      className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="billingPostalCode" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Postal Code</label>
                    <input type="text" id="billingPostalCode" name="postalCode" value={billingAddress.postalCode} onChange={handleBillingChange} required={!useSameAddress}
                      className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                  </div>
                  <div>
                    <label htmlFor="billingCountry" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Country</label>
                    <input type="text" id="billingCountry" name="country" value={billingAddress.country} onChange={handleBillingChange} required={!useSameAddress}
                      className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card-light dark:bg-card-dark p-6 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark">
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-4">Order Summary</h2>
            <div className="space-y-2 mb-6">
              {cart.map(item => (
                <div key={item.product._id} className="flex justify-between text-text-muted-light dark:text-text-muted-dark text-sm">
                  <span>{item.product.name} (x{item.quantity})</span>
                  <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-text-light dark:text-text-dark border-t border-border-light dark:border-border-dark pt-4 mt-4">
                <span>Subtotal</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-light dark:text-text-dark">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-primary-600 dark:text-primary-400 border-t border-border-light dark:border-border-dark pt-4 mt-4">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {paymentError && <p className="text-red-500 text-sm mb-4">{paymentError}</p>}

            <button
              type="submit"
              disabled={loading || cart.length === 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CreditCard size={20} />
              )}
              Pay with Stripe
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutPage;
