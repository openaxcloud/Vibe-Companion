import { useState, useEffect } from 'react';

interface NoteCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function NoteCard({ className, children }: NoteCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`notecard undefined`}>
      <div className="notecard-content">
        {children}
      </div>
    </div>
  );
}