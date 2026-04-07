import { useState, useEffect } from 'react';

interface CartPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartPage({ className, children }: CartPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartpage undefined`}>
      <div className="cartpage-content">
        {children}
      </div>
    </div>
  );
}