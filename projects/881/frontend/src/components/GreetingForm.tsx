import { useState, useEffect } from 'react';

interface GreetingFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function GreetingForm({ className, children }: GreetingFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`greetingform undefined`}>
      <div className="greetingform-content">
        {children}
      </div>
    </div>
  );
}