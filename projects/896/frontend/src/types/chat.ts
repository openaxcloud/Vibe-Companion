import { useState, useEffect } from 'react';

interface Chat.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Chat.ts({ className, children }: Chat.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chat.ts undefined`}>
      <div className="chat.ts-content">
        {children}
      </div>
    </div>
  );
}