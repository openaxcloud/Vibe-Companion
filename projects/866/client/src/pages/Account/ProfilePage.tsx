import { useState, useEffect } from 'react';

interface ProfilePageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProfilePage({ className, children }: ProfilePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`profilepage undefined`}>
      <div className="profilepage-content">
        {children}
      </div>
    </div>
  );
}