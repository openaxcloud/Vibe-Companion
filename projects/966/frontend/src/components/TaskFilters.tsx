import { useState, useEffect } from 'react';

interface TaskFiltersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TaskFilters({ className, children }: TaskFiltersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`taskfilters undefined`}>
      <div className="taskfilters-content">
        {children}
      </div>
    </div>
  );
}