import { useState, useEffect } from 'react';

interface WeatherChartProps {
  className?: string;
  children?: React.ReactNode;
}

export default function WeatherChart({ className, children }: WeatherChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`weatherchart undefined`}>
      <div className="weatherchart-content">
        {children}
      </div>
    </div>
  );
}