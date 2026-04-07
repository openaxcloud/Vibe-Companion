import { useState, useEffect } from 'react';

interface CheckoutProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Checkout({ className, children }: CheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`checkout undefined`}>
      <div className="checkout-content">
        {children}
      </div>
    </div>
  );
}