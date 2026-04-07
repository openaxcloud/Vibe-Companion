import { useState, useEffect } from 'react';

interface CategoryContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CategoryContext({ className, children }: CategoryContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`categorycontext undefined`}>
      <div className="categorycontext-content">
        {children}
      </div>
    </div>
  );
}