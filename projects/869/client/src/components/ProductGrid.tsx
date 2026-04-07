import { useState, useEffect } from 'react';

interface ProductGridProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductGrid({ className, children }: ProductGridProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productgrid undefined`}>
      <div className="productgrid-content">
        {children}
      </div>
    </div>
  );
}