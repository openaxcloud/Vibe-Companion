import { useState, useEffect } from 'react';

interface NoteFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function NoteForm({ className, children }: NoteFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`noteform undefined`}>
      <div className="noteform-content">
        {children}
      </div>
    </div>
  );
}