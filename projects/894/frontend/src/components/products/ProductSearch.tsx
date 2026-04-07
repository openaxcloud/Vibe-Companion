import { useState, useEffect } from 'react';

interface ProductSearchProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductSearch({ className, children }: ProductSearchProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productsearch undefined`}>
      <div className="productsearch-content">
        {children}
      </div>
    </div>
  );
}