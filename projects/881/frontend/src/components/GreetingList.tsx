import { useState, useEffect } from 'react';

interface GreetingListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function GreetingList({ className, children }: GreetingListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`greetinglist undefined`}>
      <div className="greetinglist-content">
        {children}
      </div>
    </div>
  );
}