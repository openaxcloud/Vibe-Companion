import { useState, useEffect } from 'react';

interface ProtectedRouteProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProtectedRoute({ className, children }: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`protectedroute undefined`}>
      <div className="protectedroute-content">
        {children}
      </div>
    </div>
  );
}