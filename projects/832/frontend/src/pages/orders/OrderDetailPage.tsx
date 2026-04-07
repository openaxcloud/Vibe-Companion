import { useState, useEffect } from 'react';

interface OrderDetailPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderDetailPage({ className, children }: OrderDetailPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderdetailpage undefined`}>
      <div className="orderdetailpage-content">
        {children}
      </div>
    </div>
  );
}