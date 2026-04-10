// MyComponent.js
import React from 'react';

const MyComponent = ({ title, onButtonClick }) => {
  return (
    <div className="bg-slate-900 p-6 rounded-xl shadow-xl transition-all duration-200">
      <h1 className="text-4xl font-bold text-white mb-4">{title}</h1>
      <button 
        onClick={onButtonClick}
        className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-800 transition-all duration-200"
      >
        Click Me
      </button>
    </div>
  );
}

export default MyComponent;