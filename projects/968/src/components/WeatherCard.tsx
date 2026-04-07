import { useState, useEffect } from 'react';

interface WeatherCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function WeatherCard({ className, children }: WeatherCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`weathercard undefined`}>
      <div className="weathercard-content">
        {children}
      </div>
    </div>
  );
}