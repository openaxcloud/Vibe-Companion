import { useState, useEffect } from 'react';

interface CounterApi.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CounterApi.ts({ className, children }: CounterApi.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`counterapi.ts undefined`}>
      <div className="counterapi.ts-content">
        {children}
      </div>
    </div>
  );
}