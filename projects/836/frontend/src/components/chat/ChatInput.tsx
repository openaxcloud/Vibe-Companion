import { useState, useEffect } from 'react';

interface ChatInputProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChatInput({ className, children }: ChatInputProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chatinput undefined`}>
      <div className="chatinput-content">
        {children}
      </div>
    </div>
  );
}