import { useState, useEffect } from 'react';

interface AuthContextProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AuthContext({ className, children }: AuthContextProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`authcontext undefined`}>
      <div className="authcontext-content">
        {children}
      </div>
    </div>
  );
}