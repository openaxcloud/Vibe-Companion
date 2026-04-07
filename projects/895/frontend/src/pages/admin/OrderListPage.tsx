import { useState, useEffect } from 'react';

interface OrderListPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderListPage({ className, children }: OrderListPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderlistpage undefined`}>
      <div className="orderlistpage-content">
        {children}
      </div>
    </div>
  );
}