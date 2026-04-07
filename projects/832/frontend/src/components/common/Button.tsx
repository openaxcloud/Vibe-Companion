import { useState, useEffect } from 'react';

interface ButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Button({ className, children }: ButtonProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`button undefined`}>
      <div className="button-content">
        {children}
      </div>
    </div>
  );
}