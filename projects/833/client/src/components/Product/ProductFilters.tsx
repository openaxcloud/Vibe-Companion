import { useState, useEffect } from 'react';

interface ProductFiltersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductFilters({ className, children }: ProductFiltersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productfilters undefined`}>
      <div className="productfilters-content">
        {children}
      </div>
    </div>
  );
}