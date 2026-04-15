import React from 'react';
import { TodoInput } from './components/TodoInput';
import { TodoList } from './components/TodoList';
import { TodoFilter } from './components/TodoFilter';
import { useTodos } from './hooks/useTodos';

function App() {
  const {
    todos,
    filter,
    setFilter,
    addTodo,
    toggleTodo,
    deleteTodo,
    activeCount,
    completedCount,
  } = useTodos();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Todo App</h1>
          <p className="text-gray-600">Stay organized and get things done</p>
        </header>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <TodoInput onAddTodo={addTodo} />
          
          <TodoList
            todos={todos}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
          
          <TodoFilter
            currentFilter={filter}
            onFilterChange={setFilter}
            activeCount={activeCount}
            completedCount={completedCount}
          />
        </div>

        <footer className="text-center mt-8 text-gray-500 text-sm">
          Built with React, TypeScript, and Tailwind CSS
        </footer>
      </div>
    </div>
  );
}

export default App;