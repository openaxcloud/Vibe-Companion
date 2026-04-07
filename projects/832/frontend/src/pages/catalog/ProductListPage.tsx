import { useState, useEffect } from 'react';

interface ProductListPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductListPage({ className, children }: ProductListPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productlistpage undefined`}>
      <div className="productlistpage-content">
        {children}
      </div>
    </div>
  );
}