import { useState, useEffect } from 'react';

interface UserAvatarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function UserAvatar({ className, children }: UserAvatarProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`useravatar undefined`}>
      <div className="useravatar-content">
        {children}
      </div>
    </div>
  );
}