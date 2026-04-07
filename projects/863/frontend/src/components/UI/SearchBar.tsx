import { useState, useEffect } from 'react';

interface SearchBarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SearchBar({ className, children }: SearchBarProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`searchbar undefined`}>
      <div className="searchbar-content">
        {children}
      </div>
    </div>
  );
}