import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="text-center py-20 animate-fade-in">
      <h1 className="text-5xl font-extrabold text-primary-400 mb-6 leading-tight">
        Your One-Stop Marketplace
      </h1>
      <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
        Discover amazing products, shop with confidence, and enjoy a seamless
        e-commerce experience. From electronics to fashion, find everything you need.
      </p>
      <div className="flex justify-center space-x-6">
        <Link
          to="/products"
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 ease-out hover:scale-105"
        >
          Shop Now
        </Link>
        <Link
          to="/register"
          className="bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg transform transition-all duration-300 ease-out hover:scale-105"
        >
          Create Account
        </Link>
      </div>

      <section className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl mx-auto">
        <div className="card-glass p-8 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <img src="/icons/fast-delivery.svg" alt="Fast Delivery" className="w-20 h-20 mb-4" />
          <h3 className="text-2xl font-semibold mb-3">Fast Delivery</h3>
          <p className="text-slate-400 leading-relaxed">
            Get your products delivered to your doorstep in record time with our efficient logistics network.
          </p>
        </div>
        <div className="card-glass p-8 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <img src="/icons/secure-payment.svg" alt="Secure Payment" className="w-20 h-20 mb-4" />
          <h3 className="text-2xl font-semibold mb-3">Secure Payments</h3>
          <p className="text-slate-400 leading-relaxed">
            Shop with peace of mind knowing your transactions are secure and protected by Stripe.
          </p>
        </div>
        <div className="card-glass p-8 flex flex-col items-center text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <img src="/icons/24-7-support.svg" alt="24/7 Support" className="w-20 h-20 mb-4" />
          <h3 className="text-2xl font-semibold mb-3">24/7 Support</h3>
          <p className="text-slate-400 leading-relaxed">
            Our dedicated support team is always ready to assist you with any queries or issues.
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;