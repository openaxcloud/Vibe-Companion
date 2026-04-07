import { useState, useEffect } from 'react';

interface RegisterPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RegisterPage({ className, children }: RegisterPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`registerpage undefined`}>
      <div className="registerpage-content">
        {children}
      </div>
    </div>
  );
}