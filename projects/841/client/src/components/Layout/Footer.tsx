import { useState, useEffect } from 'react';

interface FooterProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Footer({ className, children }: FooterProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`footer undefined`}>
      <div className="footer-content">
        {children}
      </div>
    </div>
  );
}