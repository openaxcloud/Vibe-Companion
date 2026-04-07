import { useState, useEffect } from 'react';

interface LoadingProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Loading({ className, children }: LoadingProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`loading undefined`}>
      <div className="loading-content">
        {children}
      </div>
    </div>
  );
}