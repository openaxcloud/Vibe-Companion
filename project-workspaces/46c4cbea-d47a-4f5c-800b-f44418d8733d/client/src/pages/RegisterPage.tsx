import React from 'react';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (credentials: { username: string; email: string; password: string }) => {
    try {
      await register(credentials.username, credentials.email, credentials.password);
      toast.success('Registration successful! Please log in.');
      navigate('/login'); // Redirect to login page after successful registration
    } catch (error: any) {
      toast.error(error.message || 'Registration failed.');
    }
  };

  return (
    <div className="py-8 animate-fade-in">
      <AuthForm type="register" onSubmit={handleRegister} />
    </div>
  );
};

export default RegisterPage;