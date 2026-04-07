import { useState, useEffect } from 'react';

interface ProfileFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ProfileForm({ className, children }: ProfileFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`profileform undefined`}>
      <div className="profileform-content">
        {children}
      </div>
    </div>
  );
}