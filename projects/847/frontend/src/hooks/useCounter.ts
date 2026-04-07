import { useState, useEffect } from 'react';

interface UseCounter.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function UseCounter.ts({ className, children }: UseCounter.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`usecounter.ts undefined`}>
      <div className="usecounter.ts-content">
        {children}
      </div>
    </div>
  );
}