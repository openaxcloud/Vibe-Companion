import { useState, useEffect } from 'react';

interface TodoListProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TodoList({ className, children }: TodoListProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`todolist undefined`}>
      <div className="todolist-content">
        {children}
      </div>
    </div>
  );
}