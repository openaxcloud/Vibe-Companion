import { useState, useEffect } from 'react';

interface TimerControlsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TimerControls({ className, children }: TimerControlsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`timercontrols undefined`}>
      <div className="timercontrols-content">
        {children}
      </div>
    </div>
  );
}