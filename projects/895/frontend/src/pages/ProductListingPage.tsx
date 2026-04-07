import { useState, useEffect } from 'react';

interface ProductListingPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductListingPage({ className, children }: ProductListingPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productlistingpage undefined`}>
      <div className="productlistingpage-content">
        {children}
      </div>
    </div>
  );
}