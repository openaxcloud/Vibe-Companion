import { useState, useEffect } from 'react';

interface CounterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Counter({ className, children }: CounterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`counter undefined`}>
      <div className="counter-content">
        {children}
      </div>
    </div>
  );
}