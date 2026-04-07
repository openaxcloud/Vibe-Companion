import { useState, useEffect } from 'react';

interface UseProducts.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function UseProducts.ts({ className, children }: UseProducts.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`useproducts.ts undefined`}>
      <div className="useproducts.ts-content">
        {children}
      </div>
    </div>
  );
}