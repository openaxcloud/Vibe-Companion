import { useState, useEffect } from 'react';

interface CalculatorProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Calculator({ className, children }: CalculatorProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`calculator undefined`}>
      <div className="calculator-content">
        {children}
      </div>
    </div>
  );
}