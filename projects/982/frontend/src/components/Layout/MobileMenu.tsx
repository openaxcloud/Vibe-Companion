import { useState, useEffect } from 'react';

interface MobileMenuProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MobileMenu({ className, children }: MobileMenuProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`mobilemenu undefined`}>
      <div className="mobilemenu-content">
        {children}
      </div>
    </div>
  );
}