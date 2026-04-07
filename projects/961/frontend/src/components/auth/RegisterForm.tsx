import { useState, useEffect } from 'react';

interface RegisterFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function RegisterForm({ className, children }: RegisterFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`registerform undefined`}>
      <div className="registerform-content">
        {children}
      </div>
    </div>
  );
}