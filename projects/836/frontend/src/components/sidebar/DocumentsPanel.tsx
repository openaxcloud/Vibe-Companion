import { useState, useEffect } from 'react';

interface DocumentsPanelProps {
  className?: string;
  children?: React.ReactNode;
}

export default function DocumentsPanel({ className, children }: DocumentsPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`documentspanel undefined`}>
      <div className="documentspanel-content">
        {children}
      </div>
    </div>
  );
}