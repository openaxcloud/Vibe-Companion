import { useState, useEffect } from 'react';

interface OrderHistoryProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderHistory({ className, children }: OrderHistoryProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderhistory undefined`}>
      <div className="orderhistory-content">
        {children}
      </div>
    </div>
  );
}