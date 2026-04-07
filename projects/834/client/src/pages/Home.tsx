import { useState, useEffect } from 'react';

interface HomeProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Home({ className, children }: HomeProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`home undefined`}>
      <div className="home-content">
        {children}
      </div>
    </div>
  );
}