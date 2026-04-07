import { useState, useEffect } from 'react';

interface CalculatorFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CalculatorForm({ className, children }: CalculatorFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`calculatorform undefined`}>
      <div className="calculatorform-content">
        {children}
      </div>
    </div>
  );
}