import React, { useState } from 'react';
import { User, LoginCredentials, RegisterCredentials } from '../utils/types';
import { Loader2 } from 'lucide-react'; // Assuming lucide-react for icons

interface AuthFormProps {
  type: 'login' | 'register';
  onSubmit: (credentials: LoginCredentials | RegisterCredentials) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const AuthForm: React.FC<AuthFormProps> = ({ type, onSubmit, loading, error }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'register' && password !== confirmPassword) {
      alert('Passwords do not match'); // Placeholder for a more sophisticated error display
      return;
    }
    const credentials = type === 'login'
      ? { email, password } as LoginCredentials
      : { username, email, password } as RegisterCredentials;
    await onSubmit(credentials);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {type === 'register' && (
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
          />
        </div>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
        />
      </div>
      {type === 'register' && (
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-muted-light dark:text-text-muted-dark mb-1">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-2 rounded-md bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary-600 dark:focus:ring-primary-400"
          />
        </div>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-md hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {type === 'login' ? 'Login' : 'Register'}
      </button>
    </form>
  );
};

export default AuthForm;
