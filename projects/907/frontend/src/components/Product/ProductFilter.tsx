import { useState, useEffect } from 'react';

interface ProductFilterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductFilter({ className, children }: ProductFilterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productfilter undefined`}>
      <div className="productfilter-content">
        {children}
      </div>
    </div>
  );
}