import { useState, useEffect } from 'react';

interface DashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Dashboard({ className, children }: DashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`dashboard undefined`}>
      <div className="dashboard-content">
        {children}
      </div>
    </div>
  );
}