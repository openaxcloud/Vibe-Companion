import { useState, useEffect } from 'react';

interface SalesChartProps {
  className?: string;
  children?: React.ReactNode;
}

export default function SalesChart({ className, children }: SalesChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`saleschart undefined`}>
      <div className="saleschart-content">
        {children}
      </div>
    </div>
  );
}