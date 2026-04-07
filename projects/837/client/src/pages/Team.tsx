import { useState, useEffect } from 'react';

interface TeamProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Team({ className, children }: TeamProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`team undefined`}>
      <div className="team-content">
        {children}
      </div>
    </div>
  );
}