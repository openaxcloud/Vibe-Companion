import { useState, useEffect } from 'react';

interface BillingProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Billing({ className, children }: BillingProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`billing undefined`}>
      <div className="billing-content">
        {children}
      </div>
    </div>
  );
}