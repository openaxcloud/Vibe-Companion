import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-lg hover:shadow-2xl transition-all duration-300 ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;