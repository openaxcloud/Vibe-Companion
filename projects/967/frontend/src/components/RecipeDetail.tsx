import { useState, useEffect } from 'react';

interface RecipeDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RecipeDetail({ className, children }: RecipeDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`recipedetail undefined`}>
      <div className="recipedetail-content">
        {children}
      </div>
    </div>
  );
}