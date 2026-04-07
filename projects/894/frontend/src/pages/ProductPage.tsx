import { useState, useEffect } from 'react';

interface ProductPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductPage({ className, children }: ProductPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productpage undefined`}>
      <div className="productpage-content">
        {children}
      </div>
    </div>
  );
}