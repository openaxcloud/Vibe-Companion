import { useState, useEffect } from 'react';

interface MessageListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MessageList({ className, children }: MessageListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`messagelist undefined`}>
      <div className="messagelist-content">
        {children}
      </div>
    </div>
  );
}