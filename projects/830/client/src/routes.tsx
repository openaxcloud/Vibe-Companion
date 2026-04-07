import { useState, useEffect } from 'react';

interface RoutesProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Routes({ className, children }: RoutesProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`routes undefined`}>
      <div className="routes-content">
        {children}
      </div>
    </div>
  );
}