import { useState, useEffect } from 'react';

interface AuthPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AuthPage({ className, children }: AuthPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`authpage undefined`}>
      <div className="authpage-content">
        {children}
      </div>
    </div>
  );
}