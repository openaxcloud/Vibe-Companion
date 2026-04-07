import { useState, useEffect } from 'react';

interface OrderStatusBadgeProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderStatusBadge({ className, children }: OrderStatusBadgeProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderstatusbadge undefined`}>
      <div className="orderstatusbadge-content">
        {children}
      </div>
    </div>
  );
}