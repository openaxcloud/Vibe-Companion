import { useState, useEffect } from 'react';

interface OrderSuccessProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderSuccess({ className, children }: OrderSuccessProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordersuccess undefined`}>
      <div className="ordersuccess-content">
        {children}
      </div>
    </div>
  );
}