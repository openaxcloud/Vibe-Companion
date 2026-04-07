import { useState, useEffect } from 'react';

interface RouteGuardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RouteGuard({ className, children }: RouteGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`routeguard undefined`}>
      <div className="routeguard-content">
        {children}
      </div>
    </div>
  );
}