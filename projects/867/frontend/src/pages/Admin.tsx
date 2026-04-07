import { useState, useEffect } from 'react';

interface AdminProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Admin({ className, children }: AdminProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`admin undefined`}>
      <div className="admin-content">
        {children}
      </div>
    </div>
  );
}