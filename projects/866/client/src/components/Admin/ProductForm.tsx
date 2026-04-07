import { useState, useEffect } from 'react';

interface ProductFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProductForm({ className, children }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`productform undefined`}>
      <div className="productform-content">
        {children}
      </div>
    </div>
  );
}