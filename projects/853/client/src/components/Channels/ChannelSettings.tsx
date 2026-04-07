import { useState, useEffect } from 'react';

interface ChannelSettingsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ChannelSettings({ className, children }: ChannelSettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`channelsettings undefined`}>
      <div className="channelsettings-content">
        {children}
      </div>
    </div>
  );
}