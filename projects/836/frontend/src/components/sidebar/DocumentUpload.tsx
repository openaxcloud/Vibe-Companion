import { useState, useEffect } from 'react';

interface DocumentUploadProps {
  className?: string;
  children?: React.ReactNode;
}

export default function DocumentUpload({ className, children }: DocumentUploadProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`documentupload undefined`}>
      <div className="documentupload-content">
        {children}
      </div>
    </div>
  );
}