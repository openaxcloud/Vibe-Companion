import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
}

const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false, loading = false, icon: Icon }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-3 text-white text-lg font-semibold 
        hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-400 focus:ring-opacity-50 
        disabled:bg-indigo-800 disabled:text-indigo-400 disabled:cursor-not-allowed transition-colors duration-200 ease-out
      `}
      aria-disabled={disabled || loading}
    >
      {loading && <Loader2 className="animate-spin w-5 h-5" />}
      {Icon && !loading && <Icon className="w-5 h-5" />}
      <span>{label}</span>
    </button>
  );
};

export default Button;
