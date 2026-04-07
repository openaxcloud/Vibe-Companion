import { useState, useEffect } from 'react';

interface AdminLayoutProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminLayout({ className, children }: AdminLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminlayout undefined`}>
      <div className="adminlayout-content">
        {children}
      </div>
    </div>
  );
}