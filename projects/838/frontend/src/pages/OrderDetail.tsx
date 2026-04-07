import { useState, useEffect } from 'react';

interface OrderDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderDetail({ className, children }: OrderDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderdetail undefined`}>
      <div className="orderdetail-content">
        {children}
      </div>
    </div>
  );
}