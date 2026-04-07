import { useState, useEffect } from 'react';

interface TodoFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function TodoForm({ className, children }: TodoFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`todoform undefined`}>
      <div className="todoform-content">
        {children}
      </div>
    </div>
  );
}