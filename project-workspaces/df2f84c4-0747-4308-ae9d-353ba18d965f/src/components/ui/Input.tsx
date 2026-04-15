import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className, id, ...props }) => {
  const inputId = id || props.name || Math.random().toString(36).substring(7);
  return (
    <div className="relative mb-4">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 bg-gray-800 border ${
          error ? 'border-red-500' : 'border-gray-700'
        } rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
          className || ''
        }`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Input;