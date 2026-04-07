import { useState, useEffect } from 'react';

interface OrderCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderCard({ className, children }: OrderCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordercard undefined`}>
      <div className="ordercard-content">
        {children}
      </div>
    </div>
  );
}