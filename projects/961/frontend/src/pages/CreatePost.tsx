import { useState, useEffect } from 'react';

interface CreatePostProps {
  className?: string;
  children?: React.ReactNode;
}

export default function CreatePost({ className, children }: CreatePostProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`createpost undefined`}>
      <div className="createpost-content">
        {children}
      </div>
    </div>
  );
}