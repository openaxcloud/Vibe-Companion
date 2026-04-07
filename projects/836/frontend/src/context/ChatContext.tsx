import { useState, useEffect } from 'react';

interface ChatContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChatContext({ className, children }: ChatContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chatcontext undefined`}>
      <div className="chatcontext-content">
        {children}
      </div>
    </div>
  );
}