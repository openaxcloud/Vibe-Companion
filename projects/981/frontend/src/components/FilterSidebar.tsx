import { useState, useEffect } from 'react';

interface FilterSidebarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function FilterSidebar({ className, children }: FilterSidebarProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`filtersidebar undefined`}>
      <div className="filtersidebar-content">
        {children}
      </div>
    </div>
  );
}