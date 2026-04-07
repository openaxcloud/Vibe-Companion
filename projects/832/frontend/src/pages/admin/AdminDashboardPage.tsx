import { useState, useEffect } from 'react';

interface AdminDashboardPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminDashboardPage({ className, children }: AdminDashboardPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`admindashboardpage undefined`}>
      <div className="admindashboardpage-content">
        {children}
      </div>
    </div>
  );
}