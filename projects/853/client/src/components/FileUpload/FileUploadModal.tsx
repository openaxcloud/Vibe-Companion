import { useState, useEffect } from 'react';

interface FileUploadModalProps {
  className?: string;
  children?: React.ReactNode;
}

export default function FileUploadModal({ className, children }: FileUploadModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`fileuploadmodal undefined`}>
      <div className="fileuploadmodal-content">
        {children}
      </div>
    </div>
  );
}