import { useState, useEffect } from 'react';

interface CartDrawerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartDrawer({ className, children }: CartDrawerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`cartdrawer undefined`}>
      <div className="cartdrawer-content">
        {children}
      </div>
    </div>
  );
}