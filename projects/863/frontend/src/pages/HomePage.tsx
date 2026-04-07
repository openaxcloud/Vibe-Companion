import { useState, useEffect } from 'react';

interface HomePageProps {
  className?: string;
  children?: React.ReactNode;
}

export default function HomePage({ className, children }: HomePageProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`homepage undefined`}>
      <div className="homepage-content">
        {children}
      </div>
    </div>
  );
}