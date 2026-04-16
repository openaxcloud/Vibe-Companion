import React from 'react';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (credentials: { username?: string; email?: string; password: string }) => {
    try {
      await login(credentials.email!, credentials.password);
      toast.success('Logged in successfully!');
      navigate('/dashboard'); // Redirect to dashboard or home after login
    } catch (error: any) {
      toast.error(error.message || 'Login failed.');
    }
  };

  return (
    <div className="py-8 animate-fade-in">
      <AuthForm type="login" onSubmit={handleLogin} />
    </div>
  );
};

export default LoginPage;