import { useState, useEffect } from 'react';

interface AdminDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminDashboard({ className, children }: AdminDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`admindashboard undefined`}>
      <div className="admindashboard-content">
        {children}
      </div>
    </div>
  );
}