import { useState, useEffect } from 'react';

interface TaskContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskContext({ className, children }: TaskContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskcontext undefined`}>
      <div className="taskcontext-content">
        {children}
      </div>
    </div>
  );
}