import { useState, useEffect } from 'react';

interface OrderSuccessPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderSuccessPage({ className, children }: OrderSuccessPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`ordersuccesspage undefined`}>
      <div className="ordersuccesspage-content">
        {children}
      </div>
    </div>
  );
}