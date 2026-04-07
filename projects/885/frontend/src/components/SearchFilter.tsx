import { useState, useEffect } from 'react';

interface SearchFilterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SearchFilter({ className, children }: SearchFilterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`searchfilter undefined`}>
      <div className="searchfilter-content">
        {children}
      </div>
    </div>
  );
}