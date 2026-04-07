import { useState, useEffect } from 'react';

interface ChatWindowProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChatWindow({ className, children }: ChatWindowProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`chatwindow undefined`}>
      <div className="chatwindow-content">
        {children}
      </div>
    </div>
  );
}