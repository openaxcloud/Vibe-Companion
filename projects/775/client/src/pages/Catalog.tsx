import { useState, useEffect } from 'react';

interface CatalogProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Catalog({ className, children }: CatalogProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`catalog undefined`}>
      <div className="catalog-content">
        {children}
      </div>
    </div>
  );
}