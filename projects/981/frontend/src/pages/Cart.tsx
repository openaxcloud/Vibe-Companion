import { useState, useEffect } from 'react';

interface CartProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Cart({ className, children }: CartProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cart undefined`}>
      <div className="cart-content">
        {children}
      </div>
    </div>
  );
}