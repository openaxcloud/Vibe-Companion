import { useState, useEffect } from 'react';

interface TimerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Timer({ className, children }: TimerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`timer undefined`}>
      <div className="timer-content">
        {children}
      </div>
    </div>
  );
}