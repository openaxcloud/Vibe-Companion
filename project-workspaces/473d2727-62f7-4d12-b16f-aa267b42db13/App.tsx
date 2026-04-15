import React, { useState } from "react";

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input.trim(), completed: false }]);
    setInput("");
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "system-ui, sans-serif", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>Todo App</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="Add a new todo..."
          style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 }}
        />
        <button onClick={addTodo} style={{ padding: "8px 16px", borderRadius: 6, background: "#0079F2", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}>
          Add
        </button>
      </div>
      {todos.length === 0 ? (
        <p style={{ color: "#888", textAlign: "center", padding: 32 }}>No todos yet. Add one above!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {todos.map(todo => (
            <li key={todo.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
              <span style={{ flex: 1, textDecoration: todo.completed ? "line-through" : "none", color: todo.completed ? "#aaa" : "#333" }}>
                {todo.text}
              </span>
              <button onClick={() => deleteTodo(todo.id)} style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: 16 }}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <p style={{ marginTop: 16, fontSize: 12, color: "#aaa" }}>{todos.filter(t => t.completed).length}/{todos.length} completed</p>
    </div>
  );
}

console.log("React App loaded!");
