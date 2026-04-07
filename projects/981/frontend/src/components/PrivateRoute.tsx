import { useState, useEffect } from 'react';

interface PrivateRouteProps {
  className?: string;
  children?: React.ReactNode;
}

export default function PrivateRoute({ className, children }: PrivateRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`privateroute undefined`}>
      <div className="privateroute-content">
        {children}
      </div>
    </div>
  );
}