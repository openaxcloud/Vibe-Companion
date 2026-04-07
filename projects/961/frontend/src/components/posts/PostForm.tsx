import { useState, useEffect } from 'react';

interface PostFormProps {
  className?: string;
  children?: React.ReactNode;
}

export default function PostForm({ className, children }: PostFormProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`postform undefined`}>
      <div className="postform-content">
        {children}
      </div>
    </div>
  );
}