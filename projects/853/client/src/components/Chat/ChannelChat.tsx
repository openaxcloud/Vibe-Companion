import { useState, useEffect } from 'react';

interface ChannelChatProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChannelChat({ className, children }: ChannelChatProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`channelchat undefined`}>
      <div className="channelchat-content">
        {children}
      </div>
    </div>
  );
}