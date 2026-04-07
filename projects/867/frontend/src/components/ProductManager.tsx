import { useState, useEffect } from 'react';

interface ProductManagerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductManager({ className, children }: ProductManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productmanager undefined`}>
      <div className="productmanager-content">
        {children}
      </div>
    </div>
  );
}