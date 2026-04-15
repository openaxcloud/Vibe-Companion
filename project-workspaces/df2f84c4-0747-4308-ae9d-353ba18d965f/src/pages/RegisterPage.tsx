import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', { username, email, password });
      if (response.success && response.data && response.token) {
        login(response.data, response.token);
        navigate('/');
      } else {
        setError(response.message || 'Registration failed.');
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
        <h2 className="text-3xl font-bold text-white mb-6 text-center">Create a New Account</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Username"
            type="text"
            placeholder="JohnDoe"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
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
            autoComplete="new-password"
          />
          <Input
            label="Confirm Password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </Button>
        </form>
        <p className="text-center text-slate-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Login here
          </Link>
        </p>
      </Card>
    </div>
  );
};

export default RegisterPage;