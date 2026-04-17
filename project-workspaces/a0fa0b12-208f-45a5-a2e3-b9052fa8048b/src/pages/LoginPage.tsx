import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthForm from '../components/AuthForm';

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (credentials: any) => {
    try {
      setError(null);
      await login(credentials);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'An unknown error occurred');
    }
  };

  return (
    <div className="flex justify-center items-center py-12">
      <div className="bg-card-light dark:bg-card-dark p-8 rounded-lg shadow-lg glass-effect border border-border-light dark:border-border-dark w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-text-light dark:text-text-dark mb-6">Login</h1>
        <AuthForm type="login" onSubmit={handleLogin} loading={loading} error={error} />
        <p className="text-center text-text-muted-light dark:text-text-muted-dark mt-4">
          Don't have an account? <Link to="/register" className="text-primary-600 dark:text-primary-400 hover:underline">Register</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
