import { useState, useEffect } from 'react';

interface Index.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Index.ts({ className, children }: Index.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`index.ts undefined`}>
      <div className="index.ts-content">
        {children}
      </div>
    </div>
  );
}