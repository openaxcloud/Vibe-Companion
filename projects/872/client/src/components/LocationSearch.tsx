import { useState, useEffect } from 'react';

interface LocationSearchProps {
  className?: string;
  children?: React.ReactNode;
}

export default function LocationSearch({ className, children }: LocationSearchProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`locationsearch undefined`}>
      <div className="locationsearch-content">
        {children}
      </div>
    </div>
  );
}