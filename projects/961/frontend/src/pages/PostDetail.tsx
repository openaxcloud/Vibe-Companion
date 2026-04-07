import { useState, useEffect } from 'react';

interface PostDetailProps {
  className?: string;
  children?: React.ReactNode;
}

export default function PostDetail({ className, children }: PostDetailProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`postdetail undefined`}>
      <div className="postdetail-content">
        {children}
      </div>
    </div>
  );
}