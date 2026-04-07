import { useState, useEffect } from 'react';

interface CounterDisplayProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CounterDisplay({ className, children }: CounterDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`counterdisplay undefined`}>
      <div className="counterdisplay-content">
        {children}
      </div>
    </div>
  );
}