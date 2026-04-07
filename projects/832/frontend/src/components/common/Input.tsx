import { useState, useEffect } from 'react';

interface InputProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Input({ className, children }: InputProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`input undefined`}>
      <div className="input-content">
        {children}
      </div>
    </div>
  );
}