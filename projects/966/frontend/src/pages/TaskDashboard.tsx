import { useState, useEffect } from 'react';

interface TaskDashboardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskDashboard({ className, children }: TaskDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskdashboard undefined`}>
      <div className="taskdashboard-content">
        {children}
      </div>
    </div>
  );
}