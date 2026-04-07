import { useState, useEffect } from 'react';

interface TaskListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskList({ className, children }: TaskListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`tasklist undefined`}>
      <div className="tasklist-content">
        {children}
      </div>
    </div>
  );
}