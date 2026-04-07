import { useState, useEffect } from 'react';

interface SpinnerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Spinner({ className, children }: SpinnerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`spinner undefined`}>
      <div className="spinner-content">
        {children}
      </div>
    </div>
  );
}