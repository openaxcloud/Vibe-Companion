import { useState, useEffect } from 'react';

interface ShippingFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ShippingForm({ className, children }: ShippingFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`shippingform undefined`}>
      <div className="shippingform-content">
        {children}
      </div>
    </div>
  );
}