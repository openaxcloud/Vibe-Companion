import { useState, useEffect } from 'react';

interface CartSummaryProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartSummary({ className, children }: CartSummaryProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartsummary undefined`}>
      <div className="cartsummary-content">
        {children}
      </div>
    </div>
  );
}