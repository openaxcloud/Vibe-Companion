import { useState, useEffect } from 'react';

interface OrdersPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrdersPage({ className, children }: OrdersPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderspage undefined`}>
      <div className="orderspage-content">
        {children}
      </div>
    </div>
  );
}