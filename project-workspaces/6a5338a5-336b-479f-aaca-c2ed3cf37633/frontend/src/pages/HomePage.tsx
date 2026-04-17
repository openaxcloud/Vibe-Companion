import React from 'react';
import { ShoppingBag, CreditCard, Rocket } from 'lucide-react'; // Import actual Lucide icons

const HomePage = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 animate-fade-in">
      <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-6">
        Your <span className="text-primary-400">Premium</span> E-Commerce Marketplace
      </h1>
      <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
        Discover amazing products, seamless shopping, and secure payments in one place.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <a
          href="/products"
          className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300 shadow-lg hover:shadow-glow"
        >
          Shop Now
        </a>
        <a
          href="/register"
          className="bg-transparent border border-primary-500 text-primary-400 hover:bg-primary-500 hover:text-white font-bold py-3 px-8 rounded-full text-lg transition-all duration-300"
        >
          Join Us
        </a>
      </div>

      {/* Feature Section */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        <div className="card-glass p-6 text-center hover:shadow-glow transition-all duration-300">
          <ShoppingBag className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Vast Product Catalog</h3>
          <p className="text-slate-400">Explore a wide range of products from various categories.</p>
        </div>
        <div className="card-glass p-6 text-center hover:shadow-glow transition-all duration-300">
          <CreditCard className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Secure Payments</h3>
          <p className="text-slate-400">Powered by Stripe for safe and reliable transactions.</p>
        </div>
        <div className="card-glass p-6 text-center hover:shadow-glow transition-all duration-300">
          <Rocket className="w-12 h-12 text-secondary-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Fast Shipping</h3>
          <p className="text-slate-400">Get your orders delivered quickly to your doorstep.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
