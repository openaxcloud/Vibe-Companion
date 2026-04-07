import { useState, useEffect } from 'react';

interface Weather.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Weather.ts({ className, children }: Weather.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`weather.ts undefined`}>
      <div className="weather.ts-content">
        {children}
      </div>
    </div>
  );
}