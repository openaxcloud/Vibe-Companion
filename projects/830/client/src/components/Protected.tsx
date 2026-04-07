import { useState, useEffect } from 'react';

interface ProtectedProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Protected({ className, children }: ProtectedProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`protected undefined`}>
      <div className="protected-content">
        {children}
      </div>
    </div>
  );
}