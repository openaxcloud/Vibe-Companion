import { useState, useEffect } from 'react';

interface OrderSummaryProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderSummary({ className, children }: OrderSummaryProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordersummary undefined`}>
      <div className="ordersummary-content">
        {children}
      </div>
    </div>
  );
}