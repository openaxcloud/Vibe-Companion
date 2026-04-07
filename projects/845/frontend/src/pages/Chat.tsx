import { useState, useEffect } from 'react';

interface ChatProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Chat({ className, children }: ChatProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chat undefined`}>
      <div className="chat-content">
        {children}
      </div>
    </div>
  );
}