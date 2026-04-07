import { useState, useEffect } from 'react';

interface MainLayoutProps {
  className?: string;
  children?: React.ReactNode;
}

export default function MainLayout({ className, children }: MainLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`mainlayout undefined`}>
      <div className="mainlayout-content">
        {children}
      </div>
    </div>
  );
}