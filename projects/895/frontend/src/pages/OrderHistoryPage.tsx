import { useState, useEffect } from 'react';

interface OrderHistoryPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderHistoryPage({ className, children }: OrderHistoryPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderhistorypage undefined`}>
      <div className="orderhistorypage-content">
        {children}
      </div>
    </div>
  );
}