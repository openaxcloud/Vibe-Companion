import { useState, useEffect } from 'react';

interface CartProviderProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartProvider({ className, children }: CartProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartprovider undefined`}>
      <div className="cartprovider-content">
        {children}
      </div>
    </div>
  );
}