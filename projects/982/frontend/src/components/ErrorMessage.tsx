import { useState, useEffect } from 'react';

interface ErrorMessageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ErrorMessage({ className, children }: ErrorMessageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`errormessage undefined`}>
      <div className="errormessage-content">
        {children}
      </div>
    </div>
  );
}