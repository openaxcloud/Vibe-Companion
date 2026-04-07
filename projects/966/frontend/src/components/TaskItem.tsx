import { useState, useEffect } from 'react';

interface TaskItemProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskItem({ className, children }: TaskItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskitem undefined`}>
      <div className="taskitem-content">
        {children}
      </div>
    </div>
  );
}