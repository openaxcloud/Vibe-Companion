import { useState, useEffect } from 'react';

interface CheckoutFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CheckoutForm({ className, children }: CheckoutFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`checkoutform undefined`}>
      <div className="checkoutform-content">
        {children}
      </div>
    </div>
  );
}