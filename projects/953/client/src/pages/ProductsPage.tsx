import { useState, useEffect } from 'react';

interface ProductsPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductsPage({ className, children }: ProductsPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productspage undefined`}>
      <div className="productspage-content">
        {children}
      </div>
    </div>
  );
}