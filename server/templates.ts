export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  files: { filename: string; content: string }[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "react-app",
    name: "React App",
    description: "React frontend with components and hooks",
    language: "typescript",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./App.tsx"></script>
</body>
</html>`,
      },
      {
        filename: "App.tsx",
        content: `import React, { useState } from "react";

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
`,
      },
    ],
  },
  {
    id: "express-api",
    name: "Express API",
    description: "REST API with Express and routing",
    language: "javascript",
    files: [
      {
        filename: "index.js",
        content: `const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let items = [
  { id: 1, name: "First Item", description: "This is the first item", createdAt: new Date().toISOString() },
  { id: 2, name: "Second Item", description: "This is the second item", createdAt: new Date().toISOString() },
];
let nextId = 3;

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Express API!", endpoints: ["/api/items"] });
});

app.get("/api/items", (req, res) => {
  res.json({ data: items, total: items.length });
});

app.get("/api/items/:id", (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

app.post("/api/items", (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  const item = { id: nextId++, name, description: description || "", createdAt: new Date().toISOString() };
  items.push(item);
  res.status(201).json(item);
});

app.put("/api/items/:id", (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Item not found" });
  const { name, description } = req.body;
  if (name) item.name = name;
  if (description !== undefined) item.description = description;
  res.json(item);
});

app.delete("/api/items/:id", (req, res) => {
  const index = items.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Item not found" });
  items.splice(index, 1);
  res.json({ message: "Item deleted" });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log(\`Try: GET http://localhost:\${PORT}/api/items\`);
});
`,
      },
      {
        filename: "README.md",
        content: `# Express API

A simple REST API built with Express.js.

## Endpoints

- \`GET /api/items\` - List all items
- \`GET /api/items/:id\` - Get item by ID
- \`POST /api/items\` - Create new item (body: { name, description })
- \`PUT /api/items/:id\` - Update item
- \`DELETE /api/items/:id\` - Delete item
`,
      },
    ],
  },
  {
    id: "python-flask",
    name: "Python Flask",
    description: "Flask web server with routing and templates",
    language: "python",
    files: [
      {
        filename: "main.py",
        content: `from flask import Flask, jsonify, request

app = Flask(__name__)

tasks = [
    {"id": 1, "title": "Learn Python", "done": True},
    {"id": 2, "title": "Build a Flask app", "done": False},
    {"id": 3, "title": "Deploy to production", "done": False},
]
next_id = 4


@app.route("/")
def index():
    return jsonify({
        "message": "Welcome to the Flask API!",
        "endpoints": ["/api/tasks"],
    })


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify({"data": tasks, "total": len(tasks)})


@app.route("/api/tasks/<int:task_id>", methods=["GET"])
def get_task(task_id):
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(task)


@app.route("/api/tasks", methods=["POST"])
def create_task():
    global next_id
    data = request.get_json()
    if not data or "title" not in data:
        return jsonify({"error": "Title is required"}), 400
    task = {"id": next_id, "title": data["title"], "done": False}
    next_id += 1
    tasks.append(task)
    return jsonify(task), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    task = next((t for t in tasks if t["id"] == task_id), None)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    data = request.get_json()
    if "title" in data:
        task["title"] = data["title"]
    if "done" in data:
        task["done"] = data["done"]
    return jsonify(task)


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    global tasks
    tasks = [t for t in tasks if t["id"] != task_id]
    return jsonify({"message": "Task deleted"})


if __name__ == "__main__":
    print("Flask API running on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
`,
      },
      {
        filename: "requirements.txt",
        content: `flask>=3.0.0
`,
      },
    ],
  },
  {
    id: "node-cli",
    name: "Node CLI",
    description: "Command-line tool with Node.js",
    language: "javascript",
    files: [
      {
        filename: "index.js",
        content: `const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const tasks = [];

function showHelp() {
  console.log(\`
╔══════════════════════════════════╗
║        Task Manager CLI         ║
╚══════════════════════════════════╝

Commands:
  add <task>     Add a new task
  list           List all tasks
  done <number>  Mark a task as done
  remove <num>   Remove a task
  clear          Clear all tasks
  help           Show this help
  exit           Exit the app
\`);
}

function listTasks() {
  if (tasks.length === 0) {
    console.log("\\n  No tasks yet. Use 'add <task>' to create one.\\n");
    return;
  }
  console.log("\\n  Your Tasks:");
  console.log("  " + "─".repeat(40));
  tasks.forEach((task, i) => {
    const status = task.done ? "✓" : "○";
    const text = task.done ? \`\\x1b[9m\\x1b[90m\${task.text}\\x1b[0m\` : task.text;
    console.log(\`  \${i + 1}. [\${status}] \${text}\`);
  });
  const doneCount = tasks.filter(t => t.done).length;
  console.log(\`\\n  \${doneCount}/\${tasks.length} completed\\n\`);
}

function processCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return;

  const [cmd, ...args] = trimmed.split(" ");
  const arg = args.join(" ");

  switch (cmd.toLowerCase()) {
    case "add":
      if (!arg) { console.log("  Usage: add <task description>"); break; }
      tasks.push({ text: arg, done: false });
      console.log(\`  Added: "\${arg}"\`);
      break;
    case "list":
      listTasks();
      break;
    case "done": {
      const num = parseInt(arg) - 1;
      if (isNaN(num) || num < 0 || num >= tasks.length) { console.log("  Invalid task number."); break; }
      tasks[num].done = true;
      console.log(\`  Completed: "\${tasks[num].text}"\`);
      break;
    }
    case "remove": {
      const idx = parseInt(arg) - 1;
      if (isNaN(idx) || idx < 0 || idx >= tasks.length) { console.log("  Invalid task number."); break; }
      const removed = tasks.splice(idx, 1);
      console.log(\`  Removed: "\${removed[0].text}"\`);
      break;
    }
    case "clear":
      tasks.length = 0;
      console.log("  All tasks cleared.");
      break;
    case "help":
      showHelp();
      break;
    case "exit":
    case "quit":
      console.log("  Goodbye!");
      rl.close();
      process.exit(0);
    default:
      console.log(\`  Unknown command: "\${cmd}". Type 'help' for available commands.\`);
  }
}

showHelp();

rl.on("line", processCommand);
rl.on("close", () => process.exit(0));
`,
      },
    ],
  },
  {
    id: "html-css-js",
    name: "HTML/CSS/JS",
    description: "Static website with vanilla HTML, CSS and JavaScript",
    language: "javascript",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Website</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header>
    <nav>
      <div class="logo">MyApp</div>
      <ul class="nav-links">
        <li><a href="#home" class="active">Home</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section id="home" class="hero">
      <h1>Welcome to <span class="highlight">MyApp</span></h1>
      <p>A beautiful static website built with HTML, CSS and JavaScript.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" onclick="showAlert()">Get Started</button>
        <button class="btn btn-secondary" onclick="scrollToSection('features')">Learn More</button>
      </div>
    </section>

    <section id="features" class="features">
      <h2>Features</h2>
      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>Fast</h3>
          <p>Lightning-fast performance with optimized code.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3>Beautiful</h3>
          <p>Clean, modern design with smooth animations.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3>Responsive</h3>
          <p>Looks great on any device, any screen size.</p>
        </div>
      </div>
    </section>

    <section id="about" class="about">
      <h2>About</h2>
      <p>This is a starter template for building static websites. Customize it to make it your own!</p>
    </section>

    <section id="contact" class="contact">
      <h2>Get in Touch</h2>
      <form onsubmit="handleSubmit(event)">
        <input type="text" placeholder="Your name" required />
        <input type="email" placeholder="Your email" required />
        <textarea placeholder="Your message" rows="4" required></textarea>
        <button type="submit" class="btn btn-primary">Send Message</button>
      </form>
    </section>
  </main>

  <footer>
    <p>&copy; 2024 MyApp. Built with ❤️</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`,
      },
      {
        filename: "styles.css",
        content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
  background: #fafafa;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: #0079F2;
}

.nav-links {
  list-style: none;
  display: flex;
  gap: 24px;
}

.nav-links a {
  text-decoration: none;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.active {
  color: #0079F2;
}

section {
  padding: 80px 32px;
  max-width: 960px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding-top: 120px;
  padding-bottom: 120px;
}

.hero h1 {
  font-size: 48px;
  font-weight: 800;
  margin-bottom: 16px;
  color: #1a1a1a;
}

.highlight {
  color: #0079F2;
}

.hero p {
  font-size: 18px;
  color: #666;
  margin-bottom: 32px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-primary {
  background: #0079F2;
  color: #fff;
}

.btn-primary:hover {
  background: #0066CC;
  transform: translateY(-1px);
}

.btn-secondary {
  background: transparent;
  color: #0079F2;
  border: 1px solid #0079F2;
}

.btn-secondary:hover {
  background: #0079F2;
  color: #fff;
}

.features h2,
.about h2,
.contact h2 {
  text-align: center;
  font-size: 32px;
  margin-bottom: 40px;
  color: #1a1a1a;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
}

.feature-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.feature-icon {
  font-size: 36px;
  margin-bottom: 16px;
}

.feature-card h3 {
  font-size: 18px;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.feature-card p {
  font-size: 14px;
  color: #666;
}

.about {
  text-align: center;
  background: #fff;
  border-radius: 16px;
  max-width: 640px;
  margin: 0 auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.about p {
  font-size: 16px;
  color: #666;
}

.contact form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto;
}

.contact input,
.contact textarea {
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.contact input:focus,
.contact textarea:focus {
  outline: none;
  border-color: #0079F2;
}

footer {
  text-align: center;
  padding: 32px;
  color: #999;
  font-size: 14px;
  border-top: 1px solid #eee;
}
`,
      },
      {
        filename: "script.js",
        content: `function showAlert() {
  alert("Welcome! Start customizing this template to build your website.");
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}

function handleSubmit(e) {
  e.preventDefault();
  alert("Message sent! (This is a demo)");
  e.target.reset();
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', function(e) {
    document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});

console.log("Website loaded successfully!");
`,
      },
    ],
  },
  {
    id: "go-server",
    name: "Go Server",
    description: "HTTP server with Go and net/http",
    language: "go",
    files: [
      {
        filename: "main.go",
        content: `package main

import (
        "encoding/json"
        "fmt"
        "log"
        "net/http"
)

type Item struct {
        ID   int    \`json:"id"\`
        Name string \`json:"name"\`
}

var items = []Item{
        {ID: 1, Name: "First Item"},
        {ID: 2, Name: "Second Item"},
}

func main() {
        http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(map[string]string{
                        "message": "Welcome to Go Server!",
                })
        })

        http.HandleFunc("/api/items", func(w http.ResponseWriter, r *http.Request) {
                w.Header().Set("Content-Type", "application/json")
                json.NewEncoder(w).Encode(items)
        })

        port := ":8080"
        fmt.Printf("Go server running on http://localhost%s\\n", port)
        log.Fatal(http.ListenAndServe(port, nil))
}
`,
      },
    ],
  },
  {
    id: "cpp-app",
    name: "C++ App",
    description: "C++ program with classes and STL",
    language: "cpp",
    files: [
      {
        filename: "main.cpp",
        content: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

struct Task {
    int id;
    std::string title;
    bool completed;
};

class TaskManager {
    std::vector<Task> tasks;
    int nextId = 1;

public:
    void addTask(const std::string& title) {
        tasks.push_back({nextId++, title, false});
        std::cout << "Added: " << title << std::endl;
    }

    void completeTask(int id) {
        auto it = std::find_if(tasks.begin(), tasks.end(),
            [id](const Task& t) { return t.id == id; });
        if (it != tasks.end()) {
            it->completed = true;
            std::cout << "Completed: " << it->title << std::endl;
        }
    }

    void listTasks() const {
        std::cout << "\\n=== Tasks ===" << std::endl;
        for (const auto& task : tasks) {
            std::cout << (task.completed ? "[x] " : "[ ] ")
                      << task.id << ". " << task.title << std::endl;
        }
        std::cout << "Total: " << tasks.size() << std::endl;
    }
};

int main() {
    TaskManager manager;
    manager.addTask("Learn C++");
    manager.addTask("Build a project");
    manager.addTask("Deploy to production");
    manager.completeTask(1);
    manager.listTasks();
    return 0;
}
`,
      },
    ],
  },
  {
    id: "java-app",
    name: "Java App",
    description: "Java application with OOP patterns",
    language: "java",
    files: [
      {
        filename: "Main.java",
        content: `import java.util.ArrayList;
import java.util.List;

public class Main {
    static class Task {
        int id;
        String title;
        boolean done;

        Task(int id, String title) {
            this.id = id;
            this.title = title;
            this.done = false;
        }

        @Override
        public String toString() {
            return (done ? "[x] " : "[ ] ") + id + ". " + title;
        }
    }

    static class TaskManager {
        private List<Task> tasks = new ArrayList<>();
        private int nextId = 1;

        void add(String title) {
            tasks.add(new Task(nextId++, title));
            System.out.println("Added: " + title);
        }

        void complete(int id) {
            tasks.stream()
                .filter(t -> t.id == id)
                .findFirst()
                .ifPresent(t -> {
                    t.done = true;
                    System.out.println("Completed: " + t.title);
                });
        }

        void list() {
            System.out.println("\\n=== Tasks ===");
            tasks.forEach(System.out::println);
            long doneCount = tasks.stream().filter(t -> t.done).count();
            System.out.println(doneCount + "/" + tasks.size() + " completed");
        }
    }

    public static void main(String[] args) {
        TaskManager manager = new TaskManager();
        manager.add("Learn Java");
        manager.add("Build an application");
        manager.add("Deploy to production");
        manager.complete(1);
        manager.list();
    }
}
`,
      },
    ],
  },
  {
    id: "rust-app",
    name: "Rust App",
    description: "Rust program with structs and enums",
    language: "rust",
    files: [
      {
        filename: "main.rs",
        content: `use std::fmt;

struct Task {
    id: u32,
    title: String,
    completed: bool,
}

impl fmt::Display for Task {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let status = if self.completed { "x" } else { " " };
        write!(f, "[{}] {}. {}", status, self.id, self.title)
    }
}

struct TaskManager {
    tasks: Vec<Task>,
    next_id: u32,
}

impl TaskManager {
    fn new() -> Self {
        TaskManager { tasks: Vec::new(), next_id: 1 }
    }

    fn add(&mut self, title: &str) {
        self.tasks.push(Task {
            id: self.next_id,
            title: title.to_string(),
            completed: false,
        });
        println!("Added: {}", title);
        self.next_id += 1;
    }

    fn complete(&mut self, id: u32) {
        if let Some(task) = self.tasks.iter_mut().find(|t| t.id == id) {
            task.completed = true;
            println!("Completed: {}", task.title);
        }
    }

    fn list(&self) {
        println!("\\n=== Tasks ===");
        for task in &self.tasks {
            println!("{}", task);
        }
        let done = self.tasks.iter().filter(|t| t.completed).count();
        println!("{}/{} completed", done, self.tasks.len());
    }
}

fn main() {
    let mut manager = TaskManager::new();
    manager.add("Learn Rust");
    manager.add("Build a project");
    manager.add("Deploy to production");
    manager.complete(1);
    manager.list();
}
`,
      },
    ],
  },
  {
    id: "ruby-script",
    name: "Ruby Script",
    description: "Ruby script with classes and modules",
    language: "ruby",
    files: [
      {
        filename: "main.rb",
        content: `class Task
  attr_accessor :id, :title, :completed

  def initialize(id, title)
    @id = id
    @title = title
    @completed = false
  end

  def to_s
    status = @completed ? "x" : " "
    "[#{status}] #{@id}. #{@title}"
  end
end

class TaskManager
  def initialize
    @tasks = []
    @next_id = 1
  end

  def add(title)
    task = Task.new(@next_id, title)
    @tasks << task
    @next_id += 1
    puts "Added: #{title}"
  end

  def complete(id)
    task = @tasks.find { |t| t.id == id }
    if task
      task.completed = true
      puts "Completed: #{task.title}"
    end
  end

  def list
    puts "\\n=== Tasks ==="
    @tasks.each { |t| puts t }
    done = @tasks.count(&:completed)
    puts "#{done}/#{@tasks.length} completed"
  end
end

manager = TaskManager.new
manager.add("Learn Ruby")
manager.add("Build a project")
manager.add("Deploy to production")
manager.complete(1)
manager.list
`,
      },
    ],
  },
  {
    id: "bash-script",
    name: "Bash Script",
    description: "Shell script with functions and utilities",
    language: "bash",
    files: [
      {
        filename: "main.sh",
        content: `#!/bin/bash

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\${BLUE}================================\${NC}"
echo -e "\${BLUE}   System Information Script    \${NC}"
echo -e "\${BLUE}================================\${NC}"
echo ""

echo -e "\${GREEN}>> OS Information:\${NC}"
echo "   Hostname: $(hostname)"
echo "   Kernel: $(uname -r)"
echo "   Architecture: $(uname -m)"
echo ""

echo -e "\${GREEN}>> Date & Time:\${NC}"
echo "   $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

echo -e "\${GREEN}>> Disk Usage:\${NC}"
df -h / 2>/dev/null | tail -1 | awk '{print "   Used: "$3" / "$2" ("$5" full)"}'
echo ""

echo -e "\${GREEN}>> Memory:\${NC}"
free -h 2>/dev/null | grep Mem | awk '{print "   Used: "$3" / "$2}' || echo "   Memory info not available"
echo ""

echo -e "\${GREEN}>> Environment:\${NC}"
echo "   Shell: $SHELL"
echo "   User: $(whoami)"
echo "   Home: $HOME"
echo ""

echo -e "\${YELLOW}Script completed successfully!\${NC}"
`,
      },
    ],
  },
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): { id: string; name: string; description: string; language: string }[] {
  return PROJECT_TEMPLATES.map(({ id, name, description, language }) => ({ id, name, description, language }));
}
