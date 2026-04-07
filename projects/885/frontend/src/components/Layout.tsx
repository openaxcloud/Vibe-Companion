import { useState, useEffect } from 'react';

interface LayoutProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Layout({ className, children }: LayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`layout undefined`}>
      <div className="layout-content">
        {children}
      </div>
    </div>
  );
}