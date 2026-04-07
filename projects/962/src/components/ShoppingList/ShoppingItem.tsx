import { useState, useEffect } from 'react';

interface ShoppingItemProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ShoppingItem({ className, children }: ShoppingItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`shoppingitem undefined`}>
      <div className="shoppingitem-content">
        {children}
      </div>
    </div>
  );
}