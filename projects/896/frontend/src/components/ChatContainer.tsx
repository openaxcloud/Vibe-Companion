import { useState, useEffect } from 'react';

interface ChatContainerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChatContainer({ className, children }: ChatContainerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chatcontainer undefined`}>
      <div className="chatcontainer-content">
        {children}
      </div>
    </div>
  );
}