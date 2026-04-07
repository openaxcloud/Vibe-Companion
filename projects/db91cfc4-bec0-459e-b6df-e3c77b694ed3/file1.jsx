// src/TodoList.js
   import React, { useState, useEffect } from 'react';
   import axios from 'axios';

   const TodoList = () => {
     const [todos, setTodos] = useState([]);
     const [newTodo, setNewTodo] = useState('');

     useEffect(() => {
       fetchTodos();
     }, []);

     const fetchTodos = async () => {
       const response = await axios.get('/api/todos');
       setTodos(response.data);
     };

     const addTodo = async () => {
       if (!newTodo) return;
       const response = await axios.post('/api/todos', { text: newTodo });
       setTodos([...todos, response.data]);
       setNewTodo('');
     };

     const completeTodo = async (id) => {
       await axios.patch(`/api/todos/${id}`, { completed: true });
       fetchTodos();
     };

     const deleteTodo = async (id) => {
       await axios.delete(`/api/todos/${id}`);
       fetchTodos();
     };

     return (
       <div style={{ maxWidth: '500px', margin: 'auto', textAlign: 'center' }}>
         <h1>Todo List</h1>
         <input 
           value={newTodo} 
           onChange={(e) => setNewTodo(e.target.value)} 
           placeholder="Add a new todo" 
         />
         <button onClick={addTodo}>Add</button>
         <ul>
           {todos.map(todo => (
             <li key={todo._id} style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
               {todo.text}
               <button onClick={() => completeTodo(todo._id)}>Complete</button>
               <button onClick={() => deleteTodo(todo._id)}>Delete</button>
             </li>
           ))}
         </ul>
       </div>
     );
   };

   export default TodoList;