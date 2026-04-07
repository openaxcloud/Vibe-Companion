import { useState, useEffect } from 'react';

interface LandingProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Landing({ className, children }: LandingProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`landing undefined`}>
      <div className="landing-content">
        {children}
      </div>
    </div>
  );
}