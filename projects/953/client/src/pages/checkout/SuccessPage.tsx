import { useState, useEffect } from 'react';

interface SuccessPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SuccessPage({ className, children }: SuccessPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`successpage undefined`}>
      <div className="successpage-content">
        {children}
      </div>
    </div>
  );
}