import { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function LoadingSpinner({ className, children }: LoadingSpinnerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`loadingspinner undefined`}>
      <div className="loadingspinner-content">
        {children}
      </div>
    </div>
  );
}