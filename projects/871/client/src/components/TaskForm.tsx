import { useState, useEffect } from 'react';

interface TaskFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskForm({ className, children }: TaskFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskform undefined`}>
      <div className="taskform-content">
        {children}
      </div>
    </div>
  );
}