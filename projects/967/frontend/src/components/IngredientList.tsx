import { useState, useEffect } from 'react';

interface IngredientListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function IngredientList({ className, children }: IngredientListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ingredientlist undefined`}>
      <div className="ingredientlist-content">
        {children}
      </div>
    </div>
  );
}