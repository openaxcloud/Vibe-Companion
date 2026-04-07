import { useState, useEffect } from 'react';

interface GreetingProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Greeting({ className, children }: GreetingProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`greeting undefined`}>
      <div className="greeting-content">
        {children}
      </div>
    </div>
  );
}