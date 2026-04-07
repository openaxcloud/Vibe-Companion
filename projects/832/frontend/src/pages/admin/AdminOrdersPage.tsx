import { useState, useEffect } from 'react';

interface AdminOrdersPageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AdminOrdersPage({ className, children }: AdminOrdersPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`adminorderspage undefined`}>
      <div className="adminorderspage-content">
        {children}
      </div>
    </div>
  );
}