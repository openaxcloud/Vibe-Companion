import { useState, useEffect } from 'react';

interface ChannelContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChannelContext({ className, children }: ChannelContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`channelcontext undefined`}>
      <div className="channelcontext-content">
        {children}
      </div>
    </div>
  );
}