import { useState, useEffect } from 'react';

interface ShoppingListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ShoppingList({ className, children }: ShoppingListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`shoppinglist undefined`}>
      <div className="shoppinglist-content">
        {children}
      </div>
    </div>
  );
}