import { useState, useEffect } from 'react';

interface CreateChannelModalProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CreateChannelModal({ className, children }: CreateChannelModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`createchannelmodal undefined`}>
      <div className="createchannelmodal-content">
        {children}
      </div>
    </div>
  );
}