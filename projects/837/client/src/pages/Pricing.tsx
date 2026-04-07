import { useState, useEffect } from 'react';

interface PricingProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Pricing({ className, children }: PricingProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`pricing undefined`}>
      <div className="pricing-content">
        {children}
      </div>
    </div>
  );
}