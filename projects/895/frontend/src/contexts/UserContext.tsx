import { useState, useEffect } from 'react';

interface UserContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function UserContext({ className, children }: UserContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`usercontext undefined`}>
      <div className="usercontext-content">
        {children}
      </div>
    </div>
  );
}