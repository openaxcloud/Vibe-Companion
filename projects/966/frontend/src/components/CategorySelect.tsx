import { useState, useEffect } from 'react';

interface CategorySelectProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CategorySelect({ className, children }: CategorySelectProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`categoryselect undefined`}>
      <div className="categoryselect-content">
        {children}
      </div>
    </div>
  );
}