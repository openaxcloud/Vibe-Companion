import { useState, useEffect } from 'react';

interface FiltersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Filters({ className, children }: FiltersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`filters undefined`}>
      <div className="filters-content">
        {children}
      </div>
    </div>
  );
}