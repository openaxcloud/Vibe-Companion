import { useState, useEffect } from 'react';

interface ProductListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductList({ className, children }: ProductListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productlist undefined`}>
      <div className="productlist-content">
        {children}
      </div>
    </div>
  );
}