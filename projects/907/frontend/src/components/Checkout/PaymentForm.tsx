import { useState, useEffect } from 'react';

interface PaymentFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function PaymentForm({ className, children }: PaymentFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`paymentform undefined`}>
      <div className="paymentform-content">
        {children}
      </div>
    </div>
  );
}