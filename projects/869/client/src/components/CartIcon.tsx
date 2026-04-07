import { useState, useEffect } from 'react';

interface CartIconProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CartIcon({ className, children }: CartIconProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`carticon undefined`}>
      <div className="carticon-content">
        {children}
      </div>
    </div>
  );
}