import { useState, useEffect } from 'react';

interface ResponsiveContainerProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ResponsiveContainer({ className, children }: ResponsiveContainerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`responsivecontainer undefined`}>
      <div className="responsivecontainer-content">
        {children}
      </div>
    </div>
  );
}