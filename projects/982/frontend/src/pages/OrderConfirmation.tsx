import { useState, useEffect } from 'react';

interface OrderConfirmationProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderConfirmation({ className, children }: OrderConfirmationProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderconfirmation undefined`}>
      <div className="orderconfirmation-content">
        {children}
      </div>
    </div>
  );
}