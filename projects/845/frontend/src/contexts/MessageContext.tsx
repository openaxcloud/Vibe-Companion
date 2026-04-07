import { useState, useEffect } from 'react';

interface MessageContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MessageContext({ className, children }: MessageContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`messagecontext undefined`}>
      <div className="messagecontext-content">
        {children}
      </div>
    </div>
  );
}