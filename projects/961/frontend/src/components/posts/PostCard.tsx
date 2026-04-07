import { useState, useEffect } from 'react';

interface PostCardProps {
  className?: string;
  children?: React.ReactNode;
}

export default function PostCard({ className, children }: PostCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`postcard undefined`}>
      <div className="postcard-content">
        {children}
      </div>
    </div>
  );
}