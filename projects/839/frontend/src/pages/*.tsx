import { useState, useEffect } from 'react';

interface *Props {
  className?: string;
  children?: React.ReactNode;
}

export default function *({ className, children }: *Props) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`* undefined`}>
      <div className="*-content">
        {children}
      </div>
    </div>
  );
}