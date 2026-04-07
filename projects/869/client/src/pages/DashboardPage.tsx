import { useState, useEffect } from 'react';

interface DashboardPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function DashboardPage({ className, children }: DashboardPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`dashboardpage undefined`}>
      <div className="dashboardpage-content">
        {children}
      </div>
    </div>
  );
}