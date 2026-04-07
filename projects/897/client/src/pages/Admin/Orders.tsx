import { useState, useEffect } from 'react';

interface OrdersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Orders({ className, children }: OrdersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orders undefined`}>
      <div className="orders-content">
        {children}
      </div>
    </div>
  );
}