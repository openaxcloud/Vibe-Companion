import { useState, useEffect } from 'react';

interface AuthProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Auth({ className, children }: AuthProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`auth undefined`}>
      <div className="auth-content">
        {children}
      </div>
    </div>
  );
}