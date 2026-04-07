import { useState, useEffect } from 'react';

interface App.testProps {
  className?: string;
  children?: React.ReactNode;
}

export default function App.test({ className, children }: App.testProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`app.test undefined`}>
      <div className="app.test-content">
        {children}
      </div>
    </div>
  );
}