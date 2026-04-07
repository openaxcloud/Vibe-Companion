import { useState, useEffect } from 'react';

interface OrderDetailsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderDetails({ className, children }: OrderDetailsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderdetails undefined`}>
      <div className="orderdetails-content">
        {children}
      </div>
    </div>
  );
}