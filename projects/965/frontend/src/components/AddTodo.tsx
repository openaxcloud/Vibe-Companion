import { useState, useEffect } from 'react';

interface AddTodoProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AddTodo({ className, children }: AddTodoProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`addtodo undefined`}>
      <div className="addtodo-content">
        {children}
      </div>
    </div>
  );
}