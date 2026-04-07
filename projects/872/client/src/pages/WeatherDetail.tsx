import { useState, useEffect } from 'react';

interface WeatherDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function WeatherDetail({ className, children }: WeatherDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`weatherdetail undefined`}>
      <div className="weatherdetail-content">
        {children}
      </div>
    </div>
  );
}