import { useState, useEffect } from 'react';

interface ChatHeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChatHeader({ className, children }: ChatHeaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chatheader undefined`}>
      <div className="chatheader-content">
        {children}
      </div>
    </div>
  );
}