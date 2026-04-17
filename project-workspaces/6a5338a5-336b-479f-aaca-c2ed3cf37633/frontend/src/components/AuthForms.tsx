import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const AuthForms: React.FC<{ type: 'login' | 'register' }> = ({ type }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (type === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate('/'); // Redirect to home after successful auth
    } catch (error) {
      // Error handled by AuthContext and toast
    }
  };

  return (
    <div className="card-glass p-8 max-w-md mx-auto my-10 animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6 text-center">
        {type === 'login' ? 'Login' : 'Register'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {type === 'register' && (
          <div>
            <label htmlFor="name" className="block text-slate-300 text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        )}
        <div>
          <label htmlFor="email" className="block text-slate-300 text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-slate-300 text-sm font-medium mb-2">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full p-3 bg-slate-800 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : (type === 'login' ? 'Login' : 'Register')}
        </button>
      </form>
      <p className="text-center text-slate-400 mt-6">
        {type === 'login' ? "Don't have an account? " : "Already have an account? "}
        <Link to={type === 'login' ? '/register' : '/login'} className="text-primary-400 hover:underline">
          {type === 'login' ? 'Register here' : 'Login here'}
        </Link>
      </p>
    </div>
  );
};

export default AuthForms;
