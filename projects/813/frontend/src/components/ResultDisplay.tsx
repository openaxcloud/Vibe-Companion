import { useState, useEffect } from 'react';

interface ResultDisplayProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ResultDisplay({ className, children }: ResultDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`resultdisplay undefined`}>
      <div className="resultdisplay-content">
        {children}
      </div>
    </div>
  );
}