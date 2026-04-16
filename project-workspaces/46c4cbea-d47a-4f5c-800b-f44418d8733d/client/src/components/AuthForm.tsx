import React, { useState } from 'react';
import { UserPlus, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthFormProps {
  type: 'login' | 'register';
  onSubmit: (credentials: { username?: string; email?: string; password: string }) => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ type, onSubmit }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (type === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      if (type === 'register') {
        await onSubmit({ username, email, password });
      } else {
        await onSubmit({ email, password });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <form onSubmit={handleSubmit} className="card-glass p-8 w-full max-w-md space-y-6">
        <h2 className="text-3xl font-bold text-primary-400 text-center mb-6">
          {type === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {error && (
          <div className="bg-red-500/20 text-red-300 p-3 rounded-md text-sm text-center animate-fade-in">
            {error}
          </div>
        )}

        {type === 'register' && (
          <div>
            <label htmlFor="username" className="block text-slate-300 text-sm font-semibold mb-2">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
              placeholder="Your username"
              required
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-slate-300 text-sm font-semibold mb-2">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
            placeholder="your@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-slate-300 text-sm font-semibold mb-2">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
            placeholder="••••••••"
            required
          />
        </div>

        {type === 'register' && (
          <div>
            <label htmlFor="confirmPassword" className="block text-slate-300 text-sm font-semibold mb-2">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-md bg-slate-700 border border-slate-600 text-white focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg shadow-xl transform transition-all duration-300 ease-out hover:scale-105 flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading && <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>}
          {type === 'login' ? (
            <><LogIn size={20} /> Sign In</>
          ) : (
            <><UserPlus size={20} /> Register</>
          )}
        </button>

        <p className="text-center text-slate-400 text-sm mt-4">
          {type === 'login' ? (
            <>Don't have an account? <Link to="/register" className="text-primary-400 hover:underline">Register here</Link></>
          ) : (
            <>Already have an account? <Link to="/login" className="text-primary-400 hover:underline">Login here</Link></>
          )}
        </p>
      </form>
    </div>
  );
};

export default AuthForm;