import { useState, useEffect } from 'react';

interface ChannelCreateProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChannelCreate({ className, children }: ChannelCreateProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`channelcreate undefined`}>
      <div className="channelcreate-content">
        {children}
      </div>
    </div>
  );
}