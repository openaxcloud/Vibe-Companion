import { useState, useEffect } from 'react';

interface AddItemFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function AddItemForm({ className, children }: AddItemFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`additemform undefined`}>
      <div className="additemform-content">
        {children}
      </div>
    </div>
  );
}