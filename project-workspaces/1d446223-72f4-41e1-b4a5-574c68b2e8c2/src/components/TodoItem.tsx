import React from 'react';
import { Trash2, Check } from 'lucide-react';
import { Todo } from '../types/todo';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({ todo, onToggle, onDelete }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <button
        onClick={() => onToggle(todo.id)}
        className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors ${
          todo.completed
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-green-500'
        }`}
      >
        {todo.completed && <Check size={14} />}
      </button>
      
      <span
        className={`flex-1 ${
          todo.completed
            ? 'text-gray-500 line-through'
            : 'text-gray-900'
        }`}
      >
        {todo.text}
      </span>
      
      <button
        onClick={() => onDelete(todo.id)}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};