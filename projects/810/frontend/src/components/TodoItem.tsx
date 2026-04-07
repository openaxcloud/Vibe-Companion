import { useState, useEffect } from 'react';

interface TodoItemProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TodoItem({ className, children }: TodoItemProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`todoitem undefined`}>
      <div className="todoitem-content">
        {children}
      </div>
    </div>
  );
}