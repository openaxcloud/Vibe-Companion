import { useState, useEffect } from 'react';

interface CategoryFilterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CategoryFilter({ className, children }: CategoryFilterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`categoryfilter undefined`}>
      <div className="categoryfilter-content">
        {children}
      </div>
    </div>
  );
}