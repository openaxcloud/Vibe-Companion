import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const HomePage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center px-4">
      <h1 className="text-5xl lg:text-7xl font-extrabold text-white leading-tight animate-slide-up">
        Discover, Shop, & Sell with Ease
      </h1>
      <p className="mt-6 text-xl text-slate-300 max-w-2xl animate-fade-in delay-200">
        Your ultimate destination for a seamless e-commerce experience.
        Explore a diverse marketplace or launch your own store today.
      </p>
      <div className="mt-10 flex gap-4 animate-fade-in delay-400">
        <Button size="lg" asChild>
          <Link to="/products">Start Shopping</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link to="/register">Become a Seller</Link>
        </Button>
      </div>
    </div>
  );
};

export default HomePage;