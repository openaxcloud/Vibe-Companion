import { useState, useEffect } from 'react';

interface StripeCheckoutProps {
  className?: string;
  children?: React.ReactNode;
}

export default function StripeCheckout({ className, children }: StripeCheckoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`stripecheckout undefined`}>
      <div className="stripecheckout-content">
        {children}
      </div>
    </div>
  );
}