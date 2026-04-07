import { useState, useEffect } from 'react';

interface ConversationsListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ConversationsList({ className, children }: ConversationsListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`conversationslist undefined`}>
      <div className="conversationslist-content">
        {children}
      </div>
    </div>
  );
}