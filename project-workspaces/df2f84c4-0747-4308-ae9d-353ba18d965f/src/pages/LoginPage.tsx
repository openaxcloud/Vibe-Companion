import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.success && response.data && response.token) {
        login(response.data, response.token);
        navigate('/');
      } else {
        setError(response.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-4">
      <Card className="w-full max-w-md p-8 animate-slide-up">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Login to Your Account</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            placeholder="john.doe@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
        <p className="text-center text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary hover:underline font-medium">
            Register here
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default LoginPage;