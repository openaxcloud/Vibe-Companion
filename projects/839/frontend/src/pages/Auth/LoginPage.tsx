import { useState, useEffect } from 'react';

interface LoginPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function LoginPage({ className, children }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`loginpage undefined`}>
      <div className="loginpage-content">
        {children}
      </div>
    </div>
  );
}