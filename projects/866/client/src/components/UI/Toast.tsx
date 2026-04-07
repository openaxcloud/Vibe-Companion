import { useState, useEffect } from 'react';

interface ToastProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Toast({ className, children }: ToastProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`toast undefined`}>
      <div className="toast-content">
        {children}
      </div>
    </div>
  );
}