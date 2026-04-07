import { useState, useEffect } from 'react';

interface MessageInputProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MessageInput({ className, children }: MessageInputProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`messageinput undefined`}>
      <div className="messageinput-content">
        {children}
      </div>
    </div>
  );
}