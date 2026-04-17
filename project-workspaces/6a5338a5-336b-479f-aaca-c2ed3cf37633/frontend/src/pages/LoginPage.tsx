import React from 'react';
import AuthForms from '../components/AuthForms';

const LoginPage = () => {
  return (
    <div className="py-8">
      <AuthForms type="login" />
    </div>
  );
};

export default LoginPage;
