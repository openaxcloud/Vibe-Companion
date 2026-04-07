import { useState, useEffect } from 'react';

interface AuthStore.tsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AuthStore.ts({ className, children }: AuthStore.tsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`authstore.ts undefined`}>
      <div className="authstore.ts-content">
        {children}
      </div>
    </div>
  );
}