import { useState, useEffect } from 'react';

interface MessageItemProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MessageItem({ className, children }: MessageItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`messageitem undefined`}>
      <div className="messageitem-content">
        {children}
      </div>
    </div>
  );
}