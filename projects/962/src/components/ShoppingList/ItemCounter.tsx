import { useState, useEffect } from 'react';

interface ItemCounterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ItemCounter({ className, children }: ItemCounterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`itemcounter undefined`}>
      <div className="itemcounter-content">
        {children}
      </div>
    </div>
  );
}