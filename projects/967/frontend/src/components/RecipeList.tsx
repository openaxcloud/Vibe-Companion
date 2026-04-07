import { useState, useEffect } from 'react';

interface RecipeListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RecipeList({ className, children }: RecipeListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`recipelist undefined`}>
      <div className="recipelist-content">
        {children}
      </div>
    </div>
  );
}