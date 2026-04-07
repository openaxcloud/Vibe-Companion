import { useState, useEffect } from 'react';

interface OrderListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderList({ className, children }: OrderListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderlist undefined`}>
      <div className="orderlist-content">
        {children}
      </div>
    </div>
  );
}