import React from 'react';
import CheckoutForm from '../components/CheckoutForm';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const CheckoutPage = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="text-center text-primary-400 text-xl py-10">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="card-glass p-8 max-w-md mx-auto my-10 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Authentication Required</h2>
        <p className="text-slate-400 mb-6">Please log in to proceed with checkout.</p>
        <Link to="/login" className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="py-8">
      <CheckoutForm />
    </div>
  );
};

export default CheckoutPage;
