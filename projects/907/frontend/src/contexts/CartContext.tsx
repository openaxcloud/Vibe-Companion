import { useState, useEffect } from 'react';

interface CartContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartContext({ className, children }: CartContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartcontext undefined`}>
      <div className="cartcontext-content">
        {children}
      </div>
    </div>
  );
}