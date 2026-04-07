import { useState, useEffect } from 'react';

interface IndexProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Index({ className, children }: IndexProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`index undefined`}>
      <div className="index-content">
        {children}
      </div>
    </div>
  );
}