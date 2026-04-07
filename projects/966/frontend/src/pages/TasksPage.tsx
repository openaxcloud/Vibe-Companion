import { useState, useEffect } from 'react';

interface TasksPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TasksPage({ className, children }: TasksPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskspage undefined`}>
      <div className="taskspage-content">
        {children}
      </div>
    </div>
  );
}