import { useState, useEffect } from 'react';

interface OrdersTableProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrdersTable({ className, children }: OrdersTableProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderstable undefined`}>
      <div className="orderstable-content">
        {children}
      </div>
    </div>
  );
}