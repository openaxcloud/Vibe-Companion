import { useState, useEffect } from 'react';

interface PostsProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Posts({ className, children }: PostsProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`posts undefined`}>
      <div className="posts-content">
        {children}
      </div>
    </div>
  );
}