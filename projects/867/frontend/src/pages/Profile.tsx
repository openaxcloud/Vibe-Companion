import { useState, useEffect } from 'react';

interface ProfileProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Profile({ className, children }: ProfileProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`profile undefined`}>
      <div className="profile-content">
        {children}
      </div>
    </div>
  );
}