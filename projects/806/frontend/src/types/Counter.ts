import { useState, useEffect } from 'react';

interface Counter.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Counter.ts({ className, children }: Counter.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`counter.ts undefined`}>
      <div className="counter.ts-content">
        {children}
      </div>
    </div>
  );
}