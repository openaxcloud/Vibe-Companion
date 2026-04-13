import React, { useState } from 'react';
import Button from './components/Button';

const App: React.FC = () => {
  const [count, setCount] = useState(0);

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-6 text-indigo-500">Personal Blog</h1>
      <p className="text-lg mb-4 text-slate-300">
        Welcome to my personal blog! This is a sample React app with TypeScript and Tailwind CSS.
      </p>

      <Button label="Click me" onClick={() => setCount((c) => c + 1)} />
      <p className="mt-4 text-lg text-slate-200">Button clicked {count} times.</p>
    </main>
  );
};

export default App;
