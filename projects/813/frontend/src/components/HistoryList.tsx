import { useState, useEffect } from 'react';

interface HistoryListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function HistoryList({ className, children }: HistoryListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`historylist undefined`}>
      <div className="historylist-content">
        {children}
      </div>
    </div>
  );
}