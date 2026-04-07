import { useState, useEffect } from 'react';

interface CheckoutSuccessProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CheckoutSuccess({ className, children }: CheckoutSuccessProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`checkoutsuccess undefined`}>
      <div className="checkoutsuccess-content">
        {children}
      </div>
    </div>
  );
}