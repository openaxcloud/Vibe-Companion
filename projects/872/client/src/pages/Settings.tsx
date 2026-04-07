import { useState, useEffect } from 'react';

interface SettingsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Settings({ className, children }: SettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`settings undefined`}>
      <div className="settings-content">
        {children}
      </div>
    </div>
  );
}