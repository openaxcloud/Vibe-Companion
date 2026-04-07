import { useState, useEffect } from 'react';

interface ProductDetailPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductDetailPage({ className, children }: ProductDetailPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productdetailpage undefined`}>
      <div className="productdetailpage-content">
        {children}
      </div>
    </div>
  );
}