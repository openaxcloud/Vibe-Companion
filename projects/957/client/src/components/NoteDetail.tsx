import { useState, useEffect } from 'react';

interface NoteDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function NoteDetail({ className, children }: NoteDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`notedetail undefined`}>
      <div className="notedetail-content">
        {children}
      </div>
    </div>
  );
}