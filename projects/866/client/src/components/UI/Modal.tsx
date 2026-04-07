import { useState, useEffect } from 'react';

interface ModalProps {
  className?: string;
  children?: React.ReactNode;
}

export default function Modal({ className, children }: ModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }
  
  return (
    <div className={`modal undefined`}>
      <div className="modal-content">
        {children}
      </div>
    </div>
  );
}