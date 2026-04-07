import { useState, useEffect } from 'react';

interface OrderConfirmationPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function OrderConfirmationPage({ className, children }: OrderConfirmationPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`orderconfirmationpage undefined`}>
      <div className="orderconfirmationpage-content">
        {children}
      </div>
    </div>
  );
}