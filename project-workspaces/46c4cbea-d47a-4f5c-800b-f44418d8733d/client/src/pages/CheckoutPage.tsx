import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/Toast';
import { CreditCard, Truck, User } from 'lucide-react';
import * as stripeApi from '../api/stripe';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const totalPrice = getTotalPrice();

  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    zip: '',
    country: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'stripe'>('stripe');
  const [loading, setLoading] = useState<boolean>(false);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in to complete your order.');
      navigate('/login');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Your cart is empty.');
      navigate('/products');
      return;
    }
    if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.zip || !shippingAddress.country) {
      toast.error('Please fill in all shipping details.');
      return;
    }

    setLoading(true);
    try {
      // Create a Stripe Checkout Session
      const session = await stripeApi.createCheckoutSession({
        items: cartItems.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          imageUrl: item.product.imageUrl,
        })),
        shippingAddress: shippingAddress,
      });

      // Redirect to Stripe Checkout
      if (session.url) {
        window.location.href = session.url;
      } else {
        toast.error('Failed to initiate payment. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast.error('An error occurred during checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-primary-400 mb-8 text-center">Checkout</h1>

      <form onSubmit={handleSubmitOrder} className="card-glass p-8 max-w-3xl mx-auto space-y-8">
        {/* User Information */}
        <div>
          <h2 className="text-2xl font-bold text-slate-50 mb-4 flex items-center gap-3">
            <User size={24} className="text-primary-400" /> User Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-slate-300 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={user?.email || ''}
                disabled
                className="w-full p-3 rounded-md bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-slate-300 text-sm font-semibold mb-2">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={user?.username || ''}
                disabled
                className="w-full p-3 rounded-md bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h2 className="text-2xl font-bold text-slate-50 mb-4 flex items-center gap-3">
            <Truck size={24} className="text-primary-400" /> Shipping Address
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="address" className="block text-slate-300 text-sm font-semibold mb-2">Address</label>
              <input
                type="text"
                id="address"
                name="address"
                value={shippingAddress.address}
                onChange={handleAddressChange}
                className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="city" className="block text-slate-300 text-sm font-semibold mb-2">City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={shippingAddress.city}
                  onChange={handleAddressChange}
                  className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Anytown"
                  required
                />
              </div>
              <div>
                <label htmlFor="zip" className="block text-slate-300 text-sm font-semibold mb-2">Zip Code</label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={shippingAddress.zip}
                  onChange={handleAddressChange}
                  className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
                  placeholder="12345"
                  required
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-slate-300 text-sm font-semibold mb-2">Country</label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={shippingAddress.country}
                  onChange={handleAddressChange}
                  className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
                  placeholder="USA"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div>
          <h2 className="text-2xl font-bold text-slate-50 mb-4 flex items-center gap-3">
            <CreditCard size={24} className="text-primary-400" /> Payment Method
          </h2>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="paymentMethod"
                value="stripe"
                checked={paymentMethod === 'stripe'}
                onChange={() => setPaymentMethod('stripe')}
                className="form-radio h-4 w-4 text-primary-600"
              />
              <span className="ml-2 text-slate-200">Stripe (Credit/Debit Card)</span>
            </label>
            {/* Add more payment methods here if needed */}
          </div>
        </div>

        {/* Order Summary */}
        <div className="border-t border-slate-700 pt-6">
          <h2 className="text-2xl font-bold text-slate-50 mb-4">Order Summary</h2>
          <div className="space-y-2 text-slate-300">
            {cartItems.map((item) => (
              <div key={item.product.id} className="flex justify-between">
                <span>{item.quantity} x {item.product.name}</span>
                <span>${(item.quantity * item.product.price).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 my-4"></div>
          <div className="flex justify-between text-2xl font-bold text-primary-400">
            <span>Total:</span>
            <span>${totalPrice.toFixed(2)}</span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg shadow-xl transform transition-all duration-300 ease-out hover:scale-105"
          disabled={loading || cartItems.length === 0}
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </form>
    </div>
  );
};

export default CheckoutPage;