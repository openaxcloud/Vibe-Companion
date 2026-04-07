import { useState, useEffect } from 'react';

interface OrderManagerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderManager({ className, children }: OrderManagerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordermanager undefined`}>
      <div className="ordermanager-content">
        {children}
      </div>
    </div>
  );
}