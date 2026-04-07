import { useState, useEffect } from 'react';

interface CartItemProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartItem({ className, children }: CartItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartitem undefined`}>
      <div className="cartitem-content">
        {children}
      </div>
    </div>
  );
}