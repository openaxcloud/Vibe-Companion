import { useState, useEffect } from 'react';

interface AdminProductsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminProducts({ className, children }: AdminProductsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminproducts undefined`}>
      <div className="adminproducts-content">
        {children}
      </div>
    </div>
  );
}