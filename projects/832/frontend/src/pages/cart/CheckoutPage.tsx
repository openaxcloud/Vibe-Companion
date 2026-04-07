import { useState, useEffect } from 'react';

interface CheckoutPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CheckoutPage({ className, children }: CheckoutPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`checkoutpage undefined`}>
      <div className="checkoutpage-content">
        {children}
      </div>
    </div>
  );
}