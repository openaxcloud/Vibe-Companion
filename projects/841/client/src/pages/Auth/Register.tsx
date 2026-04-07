import { useState, useEffect } from 'react';

interface RegisterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Register({ className, children }: RegisterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`register undefined`}>
      <div className="register-content">
        {children}
      </div>
    </div>
  );
}