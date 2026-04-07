import { useState, useEffect } from 'react';

interface RecipeFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RecipeForm({ className, children }: RecipeFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`recipeform undefined`}>
      <div className="recipeform-content">
        {children}
      </div>
    </div>
  );
}