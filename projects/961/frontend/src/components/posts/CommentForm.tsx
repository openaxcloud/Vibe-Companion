import { useState, useEffect } from 'react';

interface CommentFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CommentForm({ className, children }: CommentFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`commentform undefined`}>
      <div className="commentform-content">
        {children}
      </div>
    </div>
  );
}