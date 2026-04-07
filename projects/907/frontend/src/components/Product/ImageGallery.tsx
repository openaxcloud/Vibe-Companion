import { useState, useEffect } from 'react';

interface ImageGalleryProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ImageGallery({ className, children }: ImageGalleryProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`imagegallery undefined`}>
      <div className="imagegallery-content">
        {children}
      </div>
    </div>
  );
}