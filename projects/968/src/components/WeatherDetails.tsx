import { useState, useEffect } from 'react';

interface WeatherDetailsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function WeatherDetails({ className, children }: WeatherDetailsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`weatherdetails undefined`}>
      <div className="weatherdetails-content">
        {children}
      </div>
    </div>
  );
}