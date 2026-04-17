import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse rounded-full bg-primary-500 w-12 h-12" />
    </div>
  );
};
