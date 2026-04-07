import { useState, useEffect } from 'react';

interface ForgotPasswordProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ForgotPassword({ className, children }: ForgotPasswordProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`forgotpassword undefined`}>
      <div className="forgotpassword-content">
        {children}
      </div>
    </div>
  );
}