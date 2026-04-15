import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';
import { useAuth } from '../context/AuthContext';

function RegisterPage() {
  const { register, isLoading, error, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (email: string, password: string) => {
    await register(email, password);
    if (isAuthenticated) {
      navigate('/'); // Redirect to home or dashboard on successful registration
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <AuthForm type="register" onSubmit={handleSubmit} isLoading={isLoading} error={error} />
    </div>
  );
}

export default RegisterPage;
