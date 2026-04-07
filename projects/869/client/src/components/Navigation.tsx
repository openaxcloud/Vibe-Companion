import { useState, useEffect } from 'react';

interface NavigationProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Navigation({ className, children }: NavigationProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`navigation undefined`}>
      <div className="navigation-content">
        {children}
      </div>
    </div>
  );
}