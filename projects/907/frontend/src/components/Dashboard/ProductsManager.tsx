import { useState, useEffect } from 'react';

interface ProductsManagerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductsManager({ className, children }: ProductsManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productsmanager undefined`}>
      <div className="productsmanager-content">
        {children}
      </div>
    </div>
  );
}