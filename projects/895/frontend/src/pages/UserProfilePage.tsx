import { useState, useEffect } from 'react';

interface UserProfilePageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function UserProfilePage({ className, children }: UserProfilePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`userprofilepage undefined`}>
      <div className="userprofilepage-content">
        {children}
      </div>
    </div>
  );
}