import { useState, useEffect } from 'react';

interface DisplayProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Display({ className, children }: DisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`display undefined`}>
      <div className="display-content">
        {children}
      </div>
    </div>
  );
}