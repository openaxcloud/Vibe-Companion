// backend/server.js
   const express = require('express');
   const mongoose = require('mongoose');
   const cors = require('cors');
   const bodyParser = require('body-parser');

   const app = express();
   app.use(cors());
   app.use(bodyParser.json());

   mongoose.connect('mongodb://localhost:27017/todo', { useNewUrlParser: true, useUnifiedTopology: true });

   const todoSchema = new mongoose.Schema({
     text: String,
     completed: { type: Boolean, default: false }
   });

   const Todo = mongoose.model('Todo', todoSchema);

   app.get('/api/todos', async (req, res) => {
     const todos = await Todo.find();
     res.json(todos);
   });

   app.post('/api/todos', async (req, res) => {
     const todo = new Todo(req.body);
     await todo.save();
     res.json(todo);
   });

   app.patch('/api/todos/:id', async (req, res) => {
     const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
     res.json(todo);
   });

   app.delete('/api/todos/:id', async (req, res) => {
     await Todo.findByIdAndDelete(req.params.id);
     res.sendStatus(204);
   });

   const PORT = process.env.PORT || 5000;
   app.listen(PORT, () => {
     console.log(`Server is running on port ${PORT}`);
   });