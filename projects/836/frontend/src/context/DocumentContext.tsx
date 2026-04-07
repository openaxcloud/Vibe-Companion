import { useState, useEffect } from 'react';

interface DocumentContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function DocumentContext({ className, children }: DocumentContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`documentcontext undefined`}>
      <div className="documentcontext-content">
        {children}
      </div>
    </div>
  );
}