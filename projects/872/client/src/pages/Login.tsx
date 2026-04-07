import { useState, useEffect } from 'react';

interface LoginProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Login({ className, children }: LoginProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`login undefined`}>
      <div className="login-content">
        {children}
      </div>
    </div>
  );
}