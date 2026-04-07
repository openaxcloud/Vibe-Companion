import { useState, useEffect } from 'react';

interface CommentSectionProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CommentSection({ className, children }: CommentSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`commentsection undefined`}>
      <div className="commentsection-content">
        {children}
      </div>
    </div>
  );
}