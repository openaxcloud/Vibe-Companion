import { useState, useEffect } from 'react';

interface CheckoutCancelProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CheckoutCancel({ className, children }: CheckoutCancelProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`checkoutcancel undefined`}>
      <div className="checkoutcancel-content">
        {children}
      </div>
    </div>
  );
}