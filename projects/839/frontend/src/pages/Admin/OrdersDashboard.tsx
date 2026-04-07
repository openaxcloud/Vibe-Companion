import { useState, useEffect } from 'react';

interface OrdersDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrdersDashboard({ className, children }: OrdersDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordersdashboard undefined`}>
      <div className="ordersdashboard-content">
        {children}
      </div>
    </div>
  );
}