import { useState, useEffect } from 'react';

interface MiniCartProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MiniCart({ className, children }: MiniCartProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`minicart undefined`}>
      <div className="minicart-content">
        {children}
      </div>
    </div>
  );
}