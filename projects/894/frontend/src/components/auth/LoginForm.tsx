import { useState, useEffect } from 'react';

interface LoginFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function LoginForm({ className, children }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`loginform undefined`}>
      <div className="loginform-content">
        {children}
      </div>
    </div>
  );
}