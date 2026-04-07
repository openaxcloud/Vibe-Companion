import { useState, useEffect } from 'react';

interface ProductDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductDetail({ className, children }: ProductDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productdetail undefined`}>
      <div className="productdetail-content">
        {children}
      </div>
    </div>
  );
}