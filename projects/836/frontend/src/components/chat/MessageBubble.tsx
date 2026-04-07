import { useState, useEffect } from 'react';

interface MessageBubbleProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MessageBubble({ className, children }: MessageBubbleProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`messagebubble undefined`}>
      <div className="messagebubble-content">
        {children}
      </div>
    </div>
  );
}