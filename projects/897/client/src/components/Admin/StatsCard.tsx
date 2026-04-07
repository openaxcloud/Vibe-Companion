import { useState, useEffect } from 'react';

interface StatsCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function StatsCard({ className, children }: StatsCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`statscard undefined`}>
      <div className="statscard-content">
        {children}
      </div>
    </div>
  );
}