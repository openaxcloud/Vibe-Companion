import { useState, useEffect } from 'react';

interface AuthGuardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AuthGuard({ className, children }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`authguard undefined`}>
      <div className="authguard-content">
        {children}
      </div>
    </div>
  );
}