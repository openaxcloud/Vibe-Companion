import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Link } from 'react-router-dom';

interface AuthFormProps {
  type: 'login' | 'register';
  onSubmit: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
}

const AuthForm: React.FC<AuthFormProps> = ({ type, onSubmit, isLoading, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password);
  };

  const title = type === 'login' ? 'Welcome Back' : 'Create an Account';
  const description = type === 'login' ? 'Sign in to your account' : 'Join our marketplace today';
  const buttonText = type === 'login' ? 'Login' : 'Register';
  const toggleText = type === 'login' ? "Don't have an account?" : "Already have an account?";
  const toggleLinkText = type === 'login' ? 'Sign Up' : 'Login';
  const toggleLinkPath = type === 'login' ? '/register' : '/login';

  return (
    <Card className="w-full max-w-md mx-auto animate-fade-in">
      <CardHeader className="text-center">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Loading...' : buttonText}
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-slate-400">
          {toggleText}{' '}
          <Link to={toggleLinkPath} className="text-primary-400 hover:underline">
            {toggleLinkText}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default AuthForm;
