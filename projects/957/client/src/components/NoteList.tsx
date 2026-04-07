import { useState, useEffect } from 'react';

interface NoteListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function NoteList({ className, children }: NoteListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`notelist undefined`}>
      <div className="notelist-content">
        {children}
      </div>
    </div>
  );
}