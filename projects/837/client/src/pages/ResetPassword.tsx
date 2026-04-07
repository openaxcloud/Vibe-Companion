import { useState, useEffect } from 'react';

interface ResetPasswordProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ResetPassword({ className, children }: ResetPasswordProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`resetpassword undefined`}>
      <div className="resetpassword-content">
        {children}
      </div>
    </div>
  );
}