import { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TypingIndicator({ className, children }: TypingIndicatorProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`typingindicator undefined`}>
      <div className="typingindicator-content">
        {children}
      </div>
    </div>
  );
}