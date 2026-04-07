import { useState, useEffect } from 'react';

interface AdminRouteProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminRoute({ className, children }: AdminRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminroute undefined`}>
      <div className="adminroute-content">
        {children}
      </div>
    </div>
  );
}