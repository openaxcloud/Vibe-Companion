import { useState, useEffect } from 'react';

interface EditPostProps {
  className?: string;
  children?: React.ReactNode;
}

export default function EditPost({ className, children }: EditPostProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`editpost undefined`}>
      <div className="editpost-content">
        {children}
      </div>
    </div>
  );
}