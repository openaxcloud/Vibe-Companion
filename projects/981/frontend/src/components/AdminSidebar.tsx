import { useState, useEffect } from 'react';

interface AdminSidebarProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminSidebar({ className, children }: AdminSidebarProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminsidebar undefined`}>
      <div className="adminsidebar-content">
        {children}
      </div>
    </div>
  );
}