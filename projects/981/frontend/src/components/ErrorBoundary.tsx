import { useState, useEffect } from 'react';

interface ErrorBoundaryProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ErrorBoundary({ className, children }: ErrorBoundaryProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`errorboundary undefined`}>
      <div className="errorboundary-content">
        {children}
      </div>
    </div>
  );
}