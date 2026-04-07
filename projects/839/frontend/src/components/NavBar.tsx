import { useState, useEffect } from 'react';

interface NavBarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function NavBar({ className, children }: NavBarProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`navbar undefined`}>
      <div className="navbar-content">
        {children}
      </div>
    </div>
  );
}