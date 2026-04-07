import { useState, useEffect } from 'react';

interface SearchFiltersProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SearchFilters({ className, children }: SearchFiltersProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`searchfilters undefined`}>
      <div className="searchfilters-content">
        {children}
      </div>
    </div>
  );
}