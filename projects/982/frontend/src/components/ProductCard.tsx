import { useState, useEffect } from 'react';

interface ProductCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductCard({ className, children }: ProductCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productcard undefined`}>
      <div className="productcard-content">
        {children}
      </div>
    </div>
  );
}