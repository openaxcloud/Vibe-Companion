import { useState, useEffect } from 'react';

interface AdminOrdersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminOrders({ className, children }: AdminOrdersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminorders undefined`}>
      <div className="adminorders-content">
        {children}
      </div>
    </div>
  );
}