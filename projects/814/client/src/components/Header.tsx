import { useState, useEffect } from 'react';

interface HeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Header({ className, children }: HeaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`header undefined`}>
      <div className="header-content">
        {children}
      </div>
    </div>
  );
}