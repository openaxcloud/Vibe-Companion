import { useState, useEffect } from 'react';

interface ProductsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Products({ className, children }: ProductsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`products undefined`}>
      <div className="products-content">
        {children}
      </div>
    </div>
  );
}