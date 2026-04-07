import { useState, useEffect } from 'react';

interface NavbarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Navbar({ className, children }: NavbarProps) {
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