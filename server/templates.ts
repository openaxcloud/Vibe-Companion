export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  projectType?: string;
  files: { filename: string; content: string }[];
  slidesData?: any;
  videoData?: any;
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
  {
    id: "mobile-blank",
    name: "Mobile App (Blank)",
    description: "Blank React Native/Expo mobile app",
    language: "typescript",
    projectType: "mobile-app",
    files: [
      {
        filename: "app.json",
        content: `{
  "expo": {
    "name": "MyMobileApp",
    "slug": "my-mobile-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "splash": {
      "backgroundColor": "#ffffff"
    },
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro"
    }
  }
}`,
      },
      {
        filename: "package.json",
        content: `{
  "name": "my-mobile-app",
  "version": "1.0.0",
  "main": "App.tsx",
  "scripts": {
    "start": "npx expo start --web",
    "android": "npx expo start --android",
    "ios": "npx expo start --ios",
    "web": "npx expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.3",
    "react-dom": "18.3.1",
    "react-native-web": "~0.19.12"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "typescript": "~5.3.0"
  }
}`,
      },
      {
        filename: "App.tsx",
        content: `import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to My App</Text>
      <Text style={styles.subtitle}>Edit App.tsx to get started</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
  },
});
`,
      },
      {
        filename: "tsconfig.json",
        content: `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}`,
      },
    ],
  },
  {
    id: "mobile-tabs",
    name: "Mobile App (Tab Navigation)",
    description: "React Native/Expo app with tab navigation",
    language: "typescript",
    projectType: "mobile-app",
    files: [
      {
        filename: "app.json",
        content: `{
  "expo": {
    "name": "TabNavigationApp",
    "slug": "tab-navigation-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "splash": {
      "backgroundColor": "#ffffff"
    },
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro"
    }
  }
}`,
      },
      {
        filename: "package.json",
        content: `{
  "name": "tab-navigation-app",
  "version": "1.0.0",
  "main": "App.tsx",
  "scripts": {
    "start": "npx expo start --web",
    "android": "npx expo start --android",
    "ios": "npx expo start --ios",
    "web": "npx expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.3",
    "react-dom": "18.3.1",
    "react-native-web": "~0.19.12"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "typescript": "~5.3.0"
  }
}`,
      },
      {
        filename: "App.tsx",
        content: `import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from "react-native";

function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.screenTitle}>Home</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome Back!</Text>
        <Text style={styles.cardText}>This is your home screen. Start building your app here.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Tasks</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ExploreScreen() {
  const items = ["React Native", "Expo", "TypeScript", "Navigation", "Animations", "APIs"];
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.screenTitle}>Explore</Text>
      {items.map((item, i) => (
        <TouchableOpacity key={i} style={styles.listItem}>
          <View style={[styles.listIcon, { backgroundColor: \`hsl(\${i * 60}, 70%, 60%)\` }]}>
            <Text style={styles.listIconText}>{item[0]}</Text>
          </View>
          <Text style={styles.listItemText}>{item}</Text>
          <Text style={styles.listArrow}>&rsaquo;</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ProfileScreen() {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.screenTitle}>Profile</Text>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
        <Text style={styles.profileName}>Jane Doe</Text>
        <Text style={styles.profileEmail}>jane@example.com</Text>
      </View>
      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuItemText}>Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuItemText}>Notifications</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.menuItem}>
        <Text style={styles.menuItemText}>Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

type TabId = "home" | "explore" | "profile";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("home");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "home", label: "Home", icon: "\u2302" },
    { id: "explore", label: "Explore", icon: "\u2609" },
    { id: "profile", label: "Profile", icon: "\u263A" },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.content}>
        {activeTab === "home" && <HomeScreen />}
        {activeTab === "explore" && <ExploreScreen />}
        {activeTab === "profile" && <ProfileScreen />}
      </View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabIcon, activeTab === tab.id && styles.tabActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { flex: 1 },
  screen: { padding: 20, paddingTop: 60 },
  screenTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  cardText: { fontSize: 14, color: "#666", lineHeight: 20 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 12 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold", color: "#0079F2" },
  statLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  listItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8 },
  listIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 12 },
  listIconText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  listItemText: { flex: 1, fontSize: 15, fontWeight: "500" },
  listArrow: { fontSize: 20, color: "#ccc" },
  profileHeader: { alignItems: "center", marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#0079F2", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  profileName: { fontSize: 20, fontWeight: "bold" },
  profileEmail: { fontSize: 14, color: "#999", marginTop: 4 },
  menuItem: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8 },
  menuItemText: { fontSize: 15 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#eee", backgroundColor: "#fff", paddingBottom: 20, paddingTop: 8 },
  tab: { flex: 1, alignItems: "center" },
  tabIcon: { fontSize: 20, color: "#999" },
  tabLabel: { fontSize: 11, color: "#999", marginTop: 2 },
  tabActive: { color: "#0079F2" },
});
`,
      },
      {
        filename: "tsconfig.json",
        content: `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}`,
      },
    ],
  },
  {
    id: "mobile-social-feed",
    name: "Mobile App (Social Feed)",
    description: "React Native/Expo social feed app with posts and interactions",
    language: "typescript",
    projectType: "mobile-app",
    files: [
      {
        filename: "app.json",
        content: `{
  "expo": {
    "name": "SocialFeedApp",
    "slug": "social-feed-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "splash": {
      "backgroundColor": "#ffffff"
    },
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro"
    }
  }
}`,
      },
      {
        filename: "package.json",
        content: `{
  "name": "social-feed-app",
  "version": "1.0.0",
  "main": "App.tsx",
  "scripts": {
    "start": "npx expo start --web",
    "android": "npx expo start --android",
    "ios": "npx expo start --ios",
    "web": "npx expo start --web"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.3",
    "react-dom": "18.3.1",
    "react-native-web": "~0.19.12"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.0",
    "typescript": "~5.3.0"
  }
}`,
      },
      {
        filename: "App.tsx",
        content: `import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  TextInput, FlatList, Image,
} from "react-native";

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  likes: number;
  comments: number;
  liked: boolean;
  timeAgo: string;
}

const INITIAL_POSTS: Post[] = [
  { id: "1", author: "Alex Chen", avatar: "AC", content: "Just shipped a new feature using React Native and Expo! The developer experience is amazing. Hot reloading makes iteration so fast.", likes: 24, comments: 5, liked: false, timeAgo: "2h" },
  { id: "2", author: "Sarah Kim", avatar: "SK", content: "Beautiful sunset from the office rooftop today. Sometimes you need to step away from the code.", likes: 42, comments: 8, liked: true, timeAgo: "4h" },
  { id: "3", author: "Dev Community", avatar: "DC", content: "What's your favorite mobile development framework in 2025? Drop your thoughts below!", likes: 156, comments: 89, liked: false, timeAgo: "6h" },
  { id: "4", author: "Mike Johnson", avatar: "MJ", content: "TIL: You can use StyleSheet.create() for better performance in React Native. The styles get validated and optimized at creation time.", likes: 18, comments: 3, liked: false, timeAgo: "8h" },
];

function PostCard({ post, onLike }: { post: Post; onLike: () => void }) {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={[styles.postAvatar, { backgroundColor: post.liked ? "#0079F2" : "#6B7280" }]}>
          <Text style={styles.postAvatarText}>{post.avatar}</Text>
        </View>
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{post.author}</Text>
          <Text style={styles.postTime}>{post.timeAgo} ago</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Text style={[styles.actionIcon, post.liked && styles.liked]}>
            {post.liked ? "\u2665" : "\u2661"}
          </Text>
          <Text style={[styles.actionText, post.liked && styles.liked]}>{post.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>\u{1F4AC}</Text>
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>\u{1F4E4}</Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [newPost, setNewPost] = useState("");

  const handleLike = (id: string) => {
    setPosts(posts.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
  };

  const handlePost = () => {
    if (!newPost.trim()) return;
    const post: Post = {
      id: Date.now().toString(),
      author: "You",
      avatar: "ME",
      content: newPost.trim(),
      likes: 0,
      comments: 0,
      liked: false,
      timeAgo: "now",
    };
    setPosts([post, ...posts]);
    setNewPost("");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#999"
              value={newPost}
              onChangeText={setNewPost}
              multiline
            />
            <TouchableOpacity
              style={[styles.postButton, !newPost.trim() && styles.postButtonDisabled]}
              onPress={handlePost}
              disabled={!newPost.trim()}
            >
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} onLike={() => handleLike(item.id)} />}
        contentContainerStyle={styles.feed}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  header: { paddingTop: 54, paddingBottom: 12, paddingHorizontal: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  feed: { padding: 12 },
  composer: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12 },
  composerInput: { fontSize: 15, minHeight: 40, color: "#333" },
  postButton: { backgroundColor: "#0079F2", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, alignSelf: "flex-end", marginTop: 8 },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  postCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 10 },
  postAvatarText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  postMeta: { flex: 1 },
  postAuthor: { fontSize: 15, fontWeight: "600" },
  postTime: { fontSize: 12, color: "#999", marginTop: 2 },
  postContent: { fontSize: 15, lineHeight: 22, color: "#333", marginBottom: 12 },
  postActions: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  actionIcon: { fontSize: 18, marginRight: 4, color: "#666" },
  actionText: { fontSize: 13, color: "#666" },
  liked: { color: "#E54D4D" },
});
`,
      },
      {
        filename: "tsconfig.json",
        content: `{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}`,
      },
    ],
  },
  {
    id: "pitch-deck",
    name: "Pitch Deck",
    description: "Startup pitch deck with problem, solution, market, and team slides",
    language: "slides",
    projectType: "slides",
    files: [],
    slidesData: {
      slides: [
        { id: "s1", order: 0, layout: "title", blocks: [{ id: "b1", type: "title", content: "Company Name" }, { id: "b2", type: "body", content: "One-line description of what you do" }] },
        { id: "s2", order: 1, layout: "content", blocks: [{ id: "b3", type: "title", content: "The Problem" }, { id: "b4", type: "body", content: "Describe the pain point your target customers face" }] },
        { id: "s3", order: 2, layout: "content", blocks: [{ id: "b5", type: "title", content: "Our Solution" }, { id: "b6", type: "body", content: "How your product solves the problem" }] },
        { id: "s4", order: 3, layout: "content", blocks: [{ id: "b7", type: "title", content: "Market Opportunity" }, { id: "b8", type: "list", content: "- Total Addressable Market: $XX B\n- Serviceable Market: $XX B\n- Growth Rate: XX% YoY" }] },
        { id: "s5", order: 4, layout: "content", blocks: [{ id: "b9", type: "title", content: "Business Model" }, { id: "b10", type: "body", content: "How you make money" }] },
        { id: "s6", order: 5, layout: "content", blocks: [{ id: "b11", type: "title", content: "Traction" }, { id: "b12", type: "list", content: "- XX,000 users\n- $XXk MRR\n- XX% month-over-month growth" }] },
        { id: "s7", order: 6, layout: "content", blocks: [{ id: "b13", type: "title", content: "The Team" }, { id: "b14", type: "body", content: "Introduce your founding team and key hires" }] },
        { id: "s8", order: 7, layout: "content", blocks: [{ id: "b15", type: "title", content: "The Ask" }, { id: "b16", type: "body", content: "Raising $X.XM to achieve key milestones" }] },
      ],
      theme: { name: "Dark Modern", primaryColor: "#0079F2", secondaryColor: "#7C65CB", backgroundColor: "#1a1a2e", textColor: "#ffffff", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#0CCE6B" },
    },
  },
  {
    id: "tech-talk",
    name: "Technical Talk",
    description: "Conference-style technical presentation with code examples",
    language: "slides",
    projectType: "slides",
    files: [],
    slidesData: {
      slides: [
        { id: "s1", order: 0, layout: "title", blocks: [{ id: "b1", type: "title", content: "Building Scalable APIs" }, { id: "b2", type: "body", content: "Patterns and best practices for production systems" }] },
        { id: "s2", order: 1, layout: "content", blocks: [{ id: "b3", type: "title", content: "Agenda" }, { id: "b4", type: "list", content: "- Architecture overview\n- Design patterns\n- Code walkthrough\n- Performance tips\n- Q&A" }] },
        { id: "s3", order: 2, layout: "content", blocks: [{ id: "b5", type: "title", content: "Architecture" }, { id: "b6", type: "body", content: "High-level system design and component interaction" }] },
        { id: "s4", order: 3, layout: "content", blocks: [{ id: "b7", type: "title", content: "Code Example" }, { id: "b8", type: "code", content: "async function handleRequest(req) {\n  const data = await validate(req.body);\n  const result = await process(data);\n  return respond(result);\n}" }] },
        { id: "s5", order: 4, layout: "content", blocks: [{ id: "b9", type: "title", content: "Key Takeaways" }, { id: "b10", type: "list", content: "- Keep it simple\n- Measure everything\n- Fail gracefully\n- Document decisions" }] },
        { id: "s6", order: 5, layout: "title", blocks: [{ id: "b11", type: "title", content: "Thank You!" }, { id: "b12", type: "body", content: "Questions?" }] },
      ],
      theme: { name: "Ocean Blue", primaryColor: "#06b6d4", secondaryColor: "#3b82f6", backgroundColor: "#0c1220", textColor: "#e0f2fe", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#22d3ee" },
    },
  },
  {
    id: "portfolio-slides",
    name: "Portfolio Showcase",
    description: "Creative portfolio presentation with project highlights",
    language: "slides",
    projectType: "slides",
    files: [],
    slidesData: {
      slides: [
        { id: "s1", order: 0, layout: "title", blocks: [{ id: "b1", type: "title", content: "My Portfolio" }, { id: "b2", type: "body", content: "Designer & Developer" }] },
        { id: "s2", order: 1, layout: "content", blocks: [{ id: "b3", type: "title", content: "About Me" }, { id: "b4", type: "body", content: "A brief introduction about yourself and your journey" }] },
        { id: "s3", order: 2, layout: "content", blocks: [{ id: "b5", type: "title", content: "Project 1" }, { id: "b6", type: "body", content: "Description of your first featured project" }] },
        { id: "s4", order: 3, layout: "content", blocks: [{ id: "b7", type: "title", content: "Project 2" }, { id: "b8", type: "body", content: "Description of your second featured project" }] },
        { id: "s5", order: 4, layout: "content", blocks: [{ id: "b9", type: "title", content: "Skills" }, { id: "b10", type: "list", content: "- UI/UX Design\n- Frontend Development\n- Motion Graphics\n- Brand Identity" }] },
        { id: "s6", order: 5, layout: "title", blocks: [{ id: "b11", type: "title", content: "Let's Connect" }, { id: "b12", type: "body", content: "your@email.com" }] },
      ],
      theme: { name: "Royal Purple", primaryColor: "#8b5cf6", secondaryColor: "#a855f7", backgroundColor: "#1e1033", textColor: "#ede9fe", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#c084fc" },
    },
  },
  {
    id: "product-demo-video",
    name: "Product Demo",
    description: "Product demo video with intro, features, and call-to-action",
    language: "video",
    projectType: "video",
    files: [],
    videoData: {
      scenes: [
        { id: "v1", order: 0, duration: 5, backgroundColor: "#1a1a2e", elements: [{ id: "e1", type: "text", content: "Product Name", x: 10, y: 35, width: 80, height: 20, startTime: 0, endTime: 5, style: { fontSize: "56", fontWeight: "bold", color: "#ffffff", textAlign: "center" }, animation: "fade-in" }, { id: "e2", type: "text", content: "The future of productivity", x: 20, y: 55, width: 60, height: 10, startTime: 1, endTime: 5, style: { fontSize: "24", color: "#94a3b8", textAlign: "center" }, animation: "slide-up" }], transition: "fade" },
        { id: "v2", order: 1, duration: 6, backgroundColor: "#0f172a", elements: [{ id: "e3", type: "text", content: "The Problem", x: 10, y: 15, width: 80, height: 10, startTime: 0, endTime: 6, style: { fontSize: "40", fontWeight: "bold", color: "#0079F2", textAlign: "center" }, animation: "fade-in" }, { id: "e4", type: "text", content: "Teams waste 30% of their time on repetitive tasks", x: 15, y: 40, width: 70, height: 15, startTime: 1, endTime: 6, style: { fontSize: "28", color: "#e2e8f0", textAlign: "center" }, animation: "slide-up" }], transition: "slide-left" },
        { id: "v3", order: 2, duration: 6, backgroundColor: "#0f172a", elements: [{ id: "e5", type: "text", content: "The Solution", x: 10, y: 15, width: 80, height: 10, startTime: 0, endTime: 6, style: { fontSize: "40", fontWeight: "bold", color: "#0CCE6B", textAlign: "center" }, animation: "fade-in" }, { id: "e6", type: "text", content: "Automate, collaborate, and ship faster", x: 15, y: 40, width: 70, height: 15, startTime: 1, endTime: 6, style: { fontSize: "28", color: "#e2e8f0", textAlign: "center" }, animation: "slide-up" }], transition: "fade" },
        { id: "v4", order: 3, duration: 5, backgroundColor: "#1a1a2e", elements: [{ id: "e7", type: "text", content: "Try it Free", x: 20, y: 35, width: 60, height: 15, startTime: 0, endTime: 5, style: { fontSize: "48", fontWeight: "bold", color: "#ffffff", textAlign: "center" }, animation: "scale" }, { id: "e8", type: "text", content: "yourproduct.com", x: 25, y: 55, width: 50, height: 10, startTime: 1, endTime: 5, style: { fontSize: "24", color: "#0079F2", textAlign: "center" }, animation: "fade-in" }], transition: "zoom" },
      ],
      audioTracks: [],
      resolution: { width: 1920, height: 1080 },
      fps: 30,
    },
  },
  {
    id: "explainer-video",
    name: "Explainer Video",
    description: "Short explainer video with text animations and transitions",
    language: "video",
    projectType: "video",
    files: [],
    videoData: {
      scenes: [
        { id: "v1", order: 0, duration: 4, backgroundColor: "#1e1033", elements: [{ id: "e1", type: "text", content: "Did You Know?", x: 15, y: 35, width: 70, height: 20, startTime: 0, endTime: 4, style: { fontSize: "48", fontWeight: "bold", color: "#c084fc", textAlign: "center" }, animation: "scale" }], transition: "fade" },
        { id: "v2", order: 1, duration: 5, backgroundColor: "#1e1033", elements: [{ id: "e2", type: "shape", content: "rectangle", x: 5, y: 5, width: 90, height: 90, startTime: 0, endTime: 5, style: { backgroundColor: "#2d1b4e", borderRadius: "16" }, animation: "fade-in" }, { id: "e3", type: "text", content: "3 out of 4 teams\nstruggle with workflow efficiency", x: 15, y: 30, width: 70, height: 30, startTime: 0.5, endTime: 5, style: { fontSize: "32", color: "#e2e8f0", textAlign: "center" }, animation: "typewriter" }], transition: "slide-left" },
        { id: "v3", order: 2, duration: 5, backgroundColor: "#1e1033", elements: [{ id: "e4", type: "text", content: "Here's How\nWe Can Help", x: 15, y: 25, width: 70, height: 20, startTime: 0, endTime: 5, style: { fontSize: "44", fontWeight: "bold", color: "#a855f7", textAlign: "center" }, animation: "fade-in" }, { id: "e5", type: "text", content: "Simple. Powerful. Beautiful.", x: 25, y: 55, width: 50, height: 10, startTime: 1, endTime: 5, style: { fontSize: "24", color: "#94a3b8", textAlign: "center" }, animation: "slide-up" }], transition: "dissolve" },
        { id: "v4", order: 3, duration: 4, backgroundColor: "#0f172a", elements: [{ id: "e6", type: "text", content: "Get Started Today", x: 15, y: 35, width: 70, height: 15, startTime: 0, endTime: 4, style: { fontSize: "42", fontWeight: "bold", color: "#ffffff", textAlign: "center" }, animation: "scale" }, { id: "e7", type: "shape", content: "rectangle", x: 30, y: 60, width: 40, height: 12, startTime: 1, endTime: 4, style: { backgroundColor: "#8b5cf6", borderRadius: "24" }, animation: "fade-in" }, { id: "e8", type: "text", content: "Sign Up Free", x: 30, y: 62, width: 40, height: 8, startTime: 1.2, endTime: 4, style: { fontSize: "20", fontWeight: "bold", color: "#ffffff", textAlign: "center" }, animation: "fade-in" }], transition: "fade" },
      ],
      audioTracks: [],
      resolution: { width: 1920, height: 1080 },
      fps: 30,
    },
  },
  {
    id: "social-intro-video",
    name: "Social Media Intro",
    description: "Short social media intro clip with bold text and transitions",
    language: "video",
    projectType: "video",
    files: [],
    videoData: {
      scenes: [
        { id: "v1", order: 0, duration: 3, backgroundColor: "#0a0a0a", elements: [{ id: "e1", type: "shape", content: "rectangle", x: 0, y: 0, width: 100, height: 100, startTime: 0, endTime: 3, style: { backgroundColor: "#0079F2" }, animation: "none" }, { id: "e2", type: "text", content: "YOUR\nBRAND", x: 15, y: 25, width: 70, height: 40, startTime: 0.3, endTime: 3, style: { fontSize: "64", fontWeight: "bold", color: "#ffffff", textAlign: "center" }, animation: "scale" }], transition: "zoom" },
        { id: "v2", order: 1, duration: 3, backgroundColor: "#ffffff", elements: [{ id: "e3", type: "text", content: "Follow for more", x: 20, y: 35, width: 60, height: 15, startTime: 0, endTime: 3, style: { fontSize: "36", fontWeight: "bold", color: "#0a0a0a", textAlign: "center" }, animation: "slide-up" }, { id: "e4", type: "text", content: "@yourhandle", x: 25, y: 55, width: 50, height: 10, startTime: 0.5, endTime: 3, style: { fontSize: "24", color: "#0079F2", textAlign: "center" }, animation: "fade-in" }], transition: "fade" },
      ],
      audioTracks: [],
      resolution: { width: 1080, height: 1080 },
      fps: 30,
    },
  },
  {
    id: "canvas-animation",
    name: "Canvas Animation",
    description: "Interactive particle animation with play/pause and speed controls",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Particle Animation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; display: flex; flex-direction: column; align-items: center; min-height: 100vh; font-family: system-ui, sans-serif; color: #fff; }
    canvas { display: block; border-radius: 12px; margin-top: 20px; }
    .controls { display: flex; gap: 12px; margin-top: 16px; align-items: center; }
    button { padding: 8px 20px; border: 1px solid #333; background: #1a1a1a; color: #fff; border-radius: 8px; cursor: pointer; font-size: 14px; }
    button:hover { background: #252525; }
    button.active { background: #0079F2; border-color: #0079F2; }
    label { font-size: 13px; color: #888; }
    input[type=range] { width: 120px; }
    h1 { margin-top: 24px; font-size: 20px; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Particle System</h1>
  <canvas id="canvas" width="800" height="500"></canvas>
  <div class="controls">
    <button id="playBtn" class="active" onclick="togglePlay()">Pause</button>
    <label>Speed <input type="range" id="speed" min="1" max="10" value="3" oninput="setSpeed(this.value)"></label>
    <label>Count <input type="range" id="count" min="20" max="500" value="150" oninput="setCount(this.value)"></label>
    <button onclick="resetParticles()">Reset</button>
  </div>
  <script>
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    let playing = true, speed = 3, particleCount = 150;
    let particles = [];
    function createParticle() {
      return { x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, r: Math.random() * 3 + 1, hue: Math.random() * 360, alpha: Math.random() * 0.5 + 0.5 };
    }
    function resetParticles() { particles = Array.from({ length: particleCount }, createParticle); }
    resetParticles();
    function togglePlay() { playing = !playing; document.getElementById("playBtn").textContent = playing ? "Pause" : "Play"; document.getElementById("playBtn").classList.toggle("active", playing); }
    function setSpeed(v) { speed = parseInt(v); }
    function setCount(v) { particleCount = parseInt(v); while (particles.length < particleCount) particles.push(createParticle()); particles.length = particleCount; }
    function animate() {
      requestAnimationFrame(animate);
      if (!playing) return;
      ctx.fillStyle = "rgba(10,10,10,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx * speed; p.y += p.vy * speed;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = \`hsla(\${p.hue}, 80%, 60%, \${p.alpha})\`; ctx.fill();
      });
      particles.forEach((a, i) => { particles.slice(i + 1).forEach(b => { const dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy); if (dist < 100) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = \`rgba(255,255,255,\${0.1 * (1 - dist / 100)})\`; ctx.stroke(); } }); });
    }
    animate();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "design-canvas",
    name: "Design Canvas",
    description: "Interactive drawing tool with color picker, shapes, and export",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Design Canvas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; font-family: system-ui, sans-serif; color: #fff; display: flex; height: 100vh; }
    .toolbar { width: 60px; background: #16213e; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 0; border-right: 1px solid #0f3460; }
    .tool { width: 40px; height: 40px; border-radius: 8px; border: none; background: transparent; color: #ccc; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .tool.active { background: #0079F2; color: #fff; }
    .tool:hover { background: #1a365d; }
    .topbar { height: 48px; background: #16213e; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid #0f3460; }
    .topbar label { font-size: 12px; color: #888; }
    .topbar input[type=color] { width: 32px; height: 24px; border: none; border-radius: 4px; cursor: pointer; }
    .topbar input[type=range] { width: 80px; }
    .topbar button { padding: 6px 14px; background: #0079F2; border: none; color: #fff; border-radius: 6px; font-size: 12px; cursor: pointer; }
    .topbar button:hover { background: #0066cc; }
    .main { flex: 1; display: flex; flex-direction: column; }
    canvas { flex: 1; cursor: crosshair; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="tool active" id="penTool" onclick="setTool('pen')" title="Pen">&#9998;</button>
    <button class="tool" id="rectTool" onclick="setTool('rect')" title="Rectangle">&#9634;</button>
    <button class="tool" id="circleTool" onclick="setTool('circle')" title="Circle">&#9675;</button>
    <button class="tool" id="eraserTool" onclick="setTool('eraser')" title="Eraser">&#8999;</button>
  </div>
  <div class="main">
    <div class="topbar">
      <label>Color <input type="color" id="colorPicker" value="#0079F2" oninput="strokeColor=this.value"></label>
      <label>Size <input type="range" id="sizePicker" min="1" max="30" value="3" oninput="lineSize=parseInt(this.value)"></label>
      <button onclick="clearCanvas()">Clear</button>
      <button onclick="exportPNG()">Export PNG</button>
      <button onclick="undo()">Undo</button>
    </div>
    <canvas id="canvas"></canvas>
  </div>
  <script>
    const canvas = document.getElementById("canvas"), ctx = canvas.getContext("2d");
    let tool = "pen", strokeColor = "#0079F2", lineSize = 3, drawing = false, startX, startY;
    let history = [], current;
    function resize() { const r = canvas.parentElement.getBoundingClientRect(); canvas.width = r.width; canvas.height = r.height - 48; if (history.length) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = history[history.length - 1]; } }
    window.addEventListener("resize", resize); resize();
    function saveState() { history.push(canvas.toDataURL()); if (history.length > 50) history.shift(); }
    function undo() { if (history.length < 2) { ctx.clearRect(0, 0, canvas.width, canvas.height); history = []; return; } history.pop(); const img = new Image(); img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); }; img.src = history[history.length - 1]; }
    function setTool(t) { tool = t; document.querySelectorAll(".tool").forEach(b => b.classList.remove("active")); document.getElementById(t + "Tool").classList.add("active"); }
    function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); saveState(); }
    function exportPNG() { const a = document.createElement("a"); a.download = "design.png"; a.href = canvas.toDataURL(); a.click(); }
    canvas.addEventListener("mousedown", e => { drawing = true; startX = e.offsetX; startY = e.offsetY; if (tool === "pen" || tool === "eraser") { current = canvas.toDataURL(); ctx.beginPath(); ctx.moveTo(startX, startY); } });
    canvas.addEventListener("mousemove", e => { if (!drawing) return; if (tool === "pen") { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineSize; ctx.lineCap = "round"; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } else if (tool === "eraser") { ctx.strokeStyle = "#1a1a2e"; ctx.lineWidth = lineSize * 4; ctx.lineCap = "round"; ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } });
    canvas.addEventListener("mouseup", e => { if (!drawing) return; drawing = false; if (tool === "rect") { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineSize; ctx.strokeRect(startX, startY, e.offsetX - startX, e.offsetY - startY); } else if (tool === "circle") { const rx = (e.offsetX - startX) / 2, ry = (e.offsetY - startY) / 2; ctx.beginPath(); ctx.ellipse(startX + rx, startY + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2); ctx.strokeStyle = strokeColor; ctx.lineWidth = lineSize; ctx.stroke(); } saveState(); });
    saveState();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "data-dashboard",
    name: "Data Dashboard",
    description: "Interactive Chart.js dashboard with multiple chart types",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; font-family: system-ui, sans-serif; color: #e2e8f0; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; border: 1px solid #334155; }
    .card h3 { font-size: 14px; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 16px 20px; flex: 1; min-width: 140px; }
    .stat .val { font-size: 28px; font-weight: 700; }
    .stat .label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .stat.green .val { color: #22c55e; } .stat.blue .val { color: #3b82f6; } .stat.purple .val { color: #8b5cf6; } .stat.amber .val { color: #f59e0b; }
    canvas { max-height: 260px; }
  </style>
</head>
<body>
  <h1>Analytics Dashboard</h1>
  <p class="subtitle">Real-time metrics and performance overview</p>
  <div class="stats">
    <div class="stat green"><div class="val">$48.2K</div><div class="label">Revenue (MTD)</div></div>
    <div class="stat blue"><div class="val">12,847</div><div class="label">Active Users</div></div>
    <div class="stat purple"><div class="val">3.2%</div><div class="label">Conversion Rate</div></div>
    <div class="stat amber"><div class="val">98.7%</div><div class="label">Uptime</div></div>
  </div>
  <div class="grid">
    <div class="card"><h3>Revenue Over Time</h3><canvas id="lineChart"></canvas></div>
    <div class="card"><h3>Users by Source</h3><canvas id="doughnutChart"></canvas></div>
    <div class="card"><h3>Monthly Signups</h3><canvas id="barChart"></canvas></div>
    <div class="card"><h3>Performance Metrics</h3><canvas id="radarChart"></canvas></div>
  </div>
  <script>
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const colors = { blue: "#3b82f6", green: "#22c55e", purple: "#8b5cf6", amber: "#f59e0b", red: "#ef4444" };
    Chart.defaults.color = "#94a3b8"; Chart.defaults.borderColor = "#334155";
    new Chart(document.getElementById("lineChart"), { type: "line", data: { labels: months, datasets: [{ label: "Revenue", data: [12,19,15,25,22,30,28,35,32,42,38,48], borderColor: colors.blue, backgroundColor: colors.blue + "20", fill: true, tension: 0.4 }, { label: "Expenses", data: [8,12,10,15,14,18,16,20,19,24,22,26], borderColor: colors.red, backgroundColor: colors.red + "20", fill: true, tension: 0.4 }] }, options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, ticks: { callback: v => "$" + v + "K" } } } } });
    new Chart(document.getElementById("doughnutChart"), { type: "doughnut", data: { labels: ["Organic","Social","Referral","Direct","Email"], datasets: [{ data: [35,25,20,12,8], backgroundColor: [colors.blue, colors.green, colors.purple, colors.amber, colors.red] }] }, options: { responsive: true, plugins: { legend: { position: "bottom" } } } });
    new Chart(document.getElementById("barChart"), { type: "bar", data: { labels: months, datasets: [{ label: "Signups", data: [320,420,380,520,480,610,580,720,690,850,800,950], backgroundColor: colors.purple + "80", borderColor: colors.purple, borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
    new Chart(document.getElementById("radarChart"), { type: "radar", data: { labels: ["Speed","Reliability","Security","UX","Scalability","Cost"], datasets: [{ label: "Current", data: [85,90,78,88,72,65], borderColor: colors.blue, backgroundColor: colors.blue + "30" }, { label: "Target", data: [95,95,90,92,88,80], borderColor: colors.green, backgroundColor: colors.green + "20" }] }, options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { r: { beginAtZero: true, max: 100 } } } });
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "automation-script",
    name: "File Automation",
    description: "Node.js automation script with scheduling and file processing",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.js",
        content: `const fs = require("fs");
const path = require("path");

const LOG_FILE = "automation.log";
const WATCH_DIR = "./data";
const OUTPUT_DIR = "./processed";
const SCHEDULE_INTERVAL = 5000;

function log(message) {
  const timestamp = new Date().toISOString();
  const entry = \`[\${timestamp}] \${message}\`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + "\\n");
}

function ensureDirs() {
  [WATCH_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(\`Created directory: \${dir}\`);
    }
  });
}

function processFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf-8");

  let processed;
  if (ext === ".csv") {
    const lines = content.split("\\n").filter(l => l.trim());
    const headers = lines[0].split(",");
    const data = lines.slice(1).map(l => l.split(","));
    processed = JSON.stringify({ headers, rows: data, count: data.length }, null, 2);
    const outPath = path.join(OUTPUT_DIR, filename.replace(".csv", ".json"));
    fs.writeFileSync(outPath, processed);
    log(\`Processed CSV -> JSON: \${filename} (\${data.length} rows)\`);
  } else if (ext === ".txt") {
    const words = content.split(/\\s+/).length;
    const lines = content.split("\\n").length;
    const chars = content.length;
    processed = \`File: \${filename}\\nWords: \${words}\\nLines: \${lines}\\nCharacters: \${chars}\\n\`;
    const outPath = path.join(OUTPUT_DIR, filename.replace(".txt", ".stats.txt"));
    fs.writeFileSync(outPath, processed);
    log(\`Processed text stats: \${filename} (\${words} words, \${lines} lines)\`);
  } else {
    const outPath = path.join(OUTPUT_DIR, filename);
    fs.copyFileSync(filePath, outPath);
    log(\`Copied file: \${filename}\`);
  }
}

function runAutomation() {
  const files = fs.readdirSync(WATCH_DIR).filter(f => !f.startsWith("."));
  if (files.length === 0) {
    log("No files to process. Waiting...");
    return;
  }
  log(\`Found \${files.length} file(s) to process\`);
  files.forEach(file => {
    try {
      processFile(path.join(WATCH_DIR, file));
    } catch (err) {
      log(\`Error processing \${file}: \${err.message}\`);
    }
  });
  log("Batch complete.");
}

log("=== File Automation Started ===");
log(\`Watching: \${WATCH_DIR} | Output: \${OUTPUT_DIR}\`);
log(\`Schedule: every \${SCHEDULE_INTERVAL / 1000}s\`);
ensureDirs();

fs.writeFileSync(path.join(WATCH_DIR, "sample.csv"), "name,email,role\\nAlice,alice@example.com,admin\\nBob,bob@example.com,user\\nCarol,carol@example.com,editor");
fs.writeFileSync(path.join(WATCH_DIR, "notes.txt"), "Meeting notes from the team standup.\\nDiscussed automation pipeline.\\nAction items assigned to each member.\\nNext meeting scheduled for Friday.");
log("Created sample files in data directory");

runAutomation();
setInterval(runAutomation, SCHEDULE_INTERVAL);
`,
      },
    ],
  },
  {
    id: "threejs-game",
    name: "3D Game",
    description: "Three.js 3D game with controls, physics, and scoring",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>3D Cube Runner</title>
  <style>
    * { margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; font-family: system-ui, sans-serif; }
    #ui { position: fixed; top: 20px; left: 20px; color: #fff; z-index: 10; }
    #score { font-size: 28px; font-weight: 700; }
    #info { font-size: 13px; color: #888; margin-top: 4px; }
    #gameOver { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 20; display: none; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
    #gameOver h2 { font-size: 36px; margin-bottom: 8px; }
    #gameOver p { color: #888; margin-bottom: 20px; }
    #gameOver button { padding: 10px 28px; background: #0079F2; border: none; color: #fff; border-radius: 8px; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="ui"><div id="score">Score: 0</div><div id="info">Use arrow keys or WASD to move. Avoid red obstacles!</div></div>
  <div id="gameOver"><h2>Game Over!</h2><p id="finalScore">Score: 0</p><button onclick="restart()">Play Again</button></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    let scene, camera, renderer, player, obstacles = [], score = 0, speed = 0.08, alive = true;
    function init() {
      scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0a1a); scene.fog = new THREE.Fog(0x0a0a1a, 10, 50);
      camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100); camera.position.set(0, 3, 8);
      renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(innerWidth, innerHeight); document.body.appendChild(renderer.domElement);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 200), new THREE.MeshPhongMaterial({ color: 0x111122 }));
      ground.rotation.x = -Math.PI / 2; ground.position.z = -80; scene.add(ground);
      const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(5, 10, 5); scene.add(light);
      scene.add(new THREE.AmbientLight(0x404060));
      player = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshPhongMaterial({ color: 0x0079F2, emissive: 0x003366 }));
      player.position.y = 0.5; scene.add(player);
      for (let i = 0; i < 20; i++) spawnObstacle(-10 - i * 5);
      window.addEventListener("resize", () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
    }
    const keys = {};
    window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
    window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);
    function spawnObstacle(z) {
      const size = 0.5 + Math.random() * 1.2;
      const ob = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshPhongMaterial({ color: 0xe54d4d, emissive: 0x330000 }));
      ob.position.set((Math.random() - 0.5) * 8, size / 2, z || -100 - Math.random() * 20);
      scene.add(ob); obstacles.push(ob);
    }
    function checkCollision() {
      const pb = new THREE.Box3().setFromObject(player);
      for (const ob of obstacles) { if (pb.intersectsBox(new THREE.Box3().setFromObject(ob))) return true; }
      return false;
    }
    function gameOver() {
      alive = false; document.getElementById("gameOver").style.display = "flex";
      document.getElementById("finalScore").textContent = "Score: " + score;
    }
    function restart() { obstacles.forEach(o => scene.remove(o)); obstacles = []; score = 0; speed = 0.08; alive = true; player.position.set(0, 0.5, 0); document.getElementById("gameOver").style.display = "none"; for (let i = 0; i < 20; i++) spawnObstacle(-10 - i * 5); }
    function animate() {
      requestAnimationFrame(animate);
      if (!alive) { renderer.render(scene, camera); return; }
      if (keys["arrowleft"] || keys["a"]) player.position.x = Math.max(player.position.x - 0.12, -4.5);
      if (keys["arrowright"] || keys["d"]) player.position.x = Math.min(player.position.x + 0.12, 4.5);
      obstacles.forEach(ob => { ob.position.z += speed; ob.rotation.x += 0.02; ob.rotation.y += 0.01; if (ob.position.z > 10) { ob.position.z = -100; ob.position.x = (Math.random() - 0.5) * 8; } });
      if (checkCollision()) { gameOver(); return; }
      score++; speed = 0.08 + score * 0.00002;
      document.getElementById("score").textContent = "Score: " + score;
      camera.lookAt(player.position);
      renderer.render(scene, camera);
    }
    init(); animate();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "markdown-editor",
    name: "Markdown Editor",
    description: "Rich Markdown editor with live preview and HTML export",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Markdown Editor</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; height: 100vh; display: flex; flex-direction: column; }
    .toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: #1e293b; border-bottom: 1px solid #334155; flex-wrap: wrap; }
    .toolbar button { padding: 6px 10px; background: #334155; border: none; color: #94a3b8; border-radius: 6px; cursor: pointer; font-size: 13px; }
    .toolbar button:hover { background: #475569; color: #e2e8f0; }
    .toolbar .sep { width: 1px; height: 20px; background: #334155; margin: 0 4px; }
    .editor-container { flex: 1; display: flex; overflow: hidden; }
    .editor { flex: 1; resize: none; background: #0f172a; color: #e2e8f0; border: none; padding: 20px; font-family: "JetBrains Mono", monospace; font-size: 14px; line-height: 1.7; outline: none; border-right: 1px solid #334155; }
    .preview { flex: 1; padding: 20px; overflow-y: auto; background: #1e293b; }
    .preview h1 { font-size: 28px; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    .preview h2 { font-size: 22px; margin: 20px 0 10px; }
    .preview h3 { font-size: 18px; margin: 16px 0 8px; }
    .preview p { margin-bottom: 12px; line-height: 1.7; }
    .preview code { background: #334155; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .preview pre { background: #0f172a; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
    .preview pre code { background: none; padding: 0; }
    .preview ul, .preview ol { margin: 8px 0 8px 24px; }
    .preview blockquote { border-left: 3px solid #3b82f6; padding-left: 12px; margin: 12px 0; color: #94a3b8; }
    .preview a { color: #3b82f6; }
    .preview img { max-width: 100%; border-radius: 8px; }
    .status { padding: 4px 12px; background: #1e293b; border-top: 1px solid #334155; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="insertMd('**', '**')" title="Bold"><b>B</b></button>
    <button onclick="insertMd('*', '*')" title="Italic"><i>I</i></button>
    <button onclick="insertMd('~~', '~~')" title="Strikethrough"><s>S</s></button>
    <span class="sep"></span>
    <button onclick="insertLine('# ')" title="Heading 1">H1</button>
    <button onclick="insertLine('## ')" title="Heading 2">H2</button>
    <button onclick="insertLine('### ')" title="Heading 3">H3</button>
    <span class="sep"></span>
    <button onclick="insertLine('- ')" title="Bullet List">&#8226; List</button>
    <button onclick="insertLine('1. ')" title="Numbered List">1. List</button>
    <button onclick="insertLine('> ')" title="Blockquote">&ldquo; Quote</button>
    <button onclick="insertMd('\\n\`\`\`\\n', '\\n\`\`\`\\n')" title="Code Block">&lt;/&gt;</button>
    <span class="sep"></span>
    <button onclick="insertMd('[', '](url)')" title="Link">Link</button>
    <button onclick="insertMd('![alt](', ')')" title="Image">Image</button>
    <span class="sep"></span>
    <button onclick="exportHtml()">Export HTML</button>
  </div>
  <div class="editor-container">
    <textarea id="editor" class="editor" placeholder="Write Markdown here..."></textarea>
    <div id="preview" class="preview"></div>
  </div>
  <div class="status"><span id="wordCount">0 words</span><span>Markdown</span></div>
  <script>
    const editor = document.getElementById("editor");
    const preview = document.getElementById("preview");
    const wordCount = document.getElementById("wordCount");
    const defaultContent = "# Welcome to Markdown Editor\\n\\nStart writing your document here. The preview updates in real-time.\\n\\n## Features\\n\\n- **Bold**, *italic*, and ~~strikethrough~~ text\\n- Headings (H1, H2, H3)\\n- Bullet and numbered lists\\n- Blockquotes and code blocks\\n- Links and images\\n- Export to HTML\\n\\n> This is a blockquote\\n\\n\`\`\`javascript\\nconst greeting = \\"Hello, World!\\";\\nconsole.log(greeting);\\n\`\`\`\\n\\nEnjoy writing!";
    editor.value = defaultContent;
    function updatePreview() { preview.innerHTML = marked.parse(editor.value); const words = editor.value.trim().split(/\\s+/).filter(w => w).length; wordCount.textContent = words + " words"; }
    editor.addEventListener("input", updatePreview);
    function insertMd(before, after) { const s = editor.selectionStart, e = editor.selectionEnd, text = editor.value; const selected = text.substring(s, e) || "text"; editor.value = text.substring(0, s) + before + selected + after + text.substring(e); editor.focus(); editor.selectionStart = s + before.length; editor.selectionEnd = s + before.length + selected.length; updatePreview(); }
    function insertLine(prefix) { const s = editor.selectionStart, text = editor.value; const lineStart = text.lastIndexOf("\\n", s - 1) + 1; editor.value = text.substring(0, lineStart) + prefix + text.substring(lineStart); editor.focus(); updatePreview(); }
    function exportHtml() { const html = "<!DOCTYPE html>\\n<html><head><meta charset=\\"UTF-8\\"><title>Document</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#333}code{background:#f0f0f0;padding:2px 6px;border-radius:4px}pre{background:#f8f8f8;padding:16px;border-radius:8px;overflow-x:auto}pre code{background:none}blockquote{border-left:3px solid #3b82f6;padding-left:12px;color:#666}</style></head><body>" + marked.parse(editor.value) + "</body></html>"; const blob = new Blob([html], { type: "text/html" }); const a = document.createElement("a"); a.download = "document.html"; a.href = URL.createObjectURL(blob); a.click(); }
    updatePreview();
  </script>
</body>
</html>`,
      },
    ],
  },
  {
    id: "spreadsheet-app",
    name: "Spreadsheet",
    description: "Interactive spreadsheet with formulas, sorting, and CSV import/export",
    language: "javascript",
    projectType: "web-app",
    files: [
      {
        filename: "index.html",
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Spreadsheet</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    .toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #1e293b; border-bottom: 1px solid #334155; }
    .toolbar button { padding: 6px 14px; background: #334155; border: none; color: #94a3b8; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .toolbar button:hover { background: #475569; color: #e2e8f0; }
    .toolbar .sep { width: 1px; height: 20px; background: #334155; }
    #formulaBar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #1e293b; border-bottom: 1px solid #334155; }
    #cellRef { width: 60px; background: #334155; border: 1px solid #475569; color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 12px; text-align: center; }
    #formulaInput { flex: 1; background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 4px 8px; border-radius: 4px; font-size: 13px; font-family: "JetBrains Mono", monospace; }
    .grid-container { overflow: auto; height: calc(100vh - 88px); }
    table { border-collapse: collapse; width: max-content; }
    th { background: #1e293b; color: #64748b; font-size: 11px; font-weight: 600; padding: 6px 8px; border: 1px solid #334155; position: sticky; top: 0; z-index: 2; min-width: 100px; cursor: pointer; user-select: none; }
    th:hover { background: #334155; }
    th.row-header { min-width: 40px; position: sticky; left: 0; z-index: 3; }
    td { padding: 0; border: 1px solid #334155; min-width: 100px; height: 28px; }
    td.row-num { background: #1e293b; color: #64748b; font-size: 11px; text-align: center; min-width: 40px; position: sticky; left: 0; z-index: 1; }
    td input { width: 100%; height: 100%; background: transparent; border: none; color: #e2e8f0; padding: 4px 8px; font-size: 13px; outline: none; font-family: "JetBrains Mono", monospace; }
    td input:focus { background: #1e293b; box-shadow: inset 0 0 0 2px #3b82f6; }
    td.formula-result { color: #22c55e; }
    .status { padding: 4px 12px; background: #1e293b; border-top: 1px solid #334155; font-size: 11px; color: #64748b; display: flex; justify-content: space-between; position: fixed; bottom: 0; left: 0; right: 0; }
    input[type=file] { display: none; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="document.getElementById('csvImport').click()">Import CSV</button>
    <button onclick="exportCSV()">Export CSV</button>
    <span class="sep"></span>
    <button onclick="sortColumn(true)">Sort A-Z</button>
    <button onclick="sortColumn(false)">Sort Z-A</button>
    <span class="sep"></span>
    <button onclick="clearAll()">Clear All</button>
    <input type="file" id="csvImport" accept=".csv" onchange="importCSV(event)">
  </div>
  <div id="formulaBar">
    <input id="cellRef" readonly value="A1">
    <input id="formulaInput" placeholder="Enter value or formula (=SUM(A1:A10))" onkeydown="if(event.key==='Enter'){applyFormula(); event.preventDefault();}">
  </div>
  <div class="grid-container"><table id="grid"></table></div>
  <div class="status"><span id="statusInfo">Ready</span><span id="selectionInfo">-</span></div>
  <script>
    const ROWS = 50, COLS = 26;
    const data = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    let selectedRow = 0, selectedCol = 0, sortCol = null;
    function colLabel(c) { return String.fromCharCode(65 + c); }
    function cellId(r, c) { return colLabel(c) + (r + 1); }
    function parseCellRef(ref) { const m = ref.match(/^([A-Z])(\\d+)$/); if (!m) return null; return [parseInt(m[2]) - 1, m[1].charCodeAt(0) - 65]; }
    function evaluate(val) {
      if (!val || !val.startsWith("=")) return val;
      const formula = val.substring(1).toUpperCase();
      try {
        const sumMatch = formula.match(/^SUM\\(([A-Z])(\\d+):([A-Z])(\\d+)\\)$/);
        const avgMatch = formula.match(/^AVG\\(([A-Z])(\\d+):([A-Z])(\\d+)\\)$/);
        const countMatch = formula.match(/^COUNT\\(([A-Z])(\\d+):([A-Z])(\\d+)\\)$/);
        if (sumMatch || avgMatch || countMatch) {
          const m = sumMatch || avgMatch || countMatch;
          const c1 = m[1].charCodeAt(0) - 65, r1 = parseInt(m[2]) - 1, c2 = m[3].charCodeAt(0) - 65, r2 = parseInt(m[4]) - 1;
          let sum = 0, count = 0;
          for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
            for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
              const v = parseFloat(evaluate(data[r]?.[c]));
              if (!isNaN(v)) { sum += v; count++; }
            }
          }
          if (sumMatch) return sum; if (avgMatch) return count > 0 ? (sum / count).toFixed(2) : 0; if (countMatch) return count;
        }
        const cellRefs = formula.replace(/([A-Z])(\\d+)/g, (_, c, r) => { const v = evaluate(data[parseInt(r)-1]?.[c.charCodeAt(0)-65]); return isNaN(v) ? 0 : v; });
        return Function(\`"use strict"; return (\${cellRefs})\`)();
      } catch { return "#ERR"; }
    }
    function render() {
      const table = document.getElementById("grid");
      let html = "<tr><th class='row-header'></th>";
      for (let c = 0; c < COLS; c++) html += \`<th onclick="sortByCol(\${c})" title="Click to sort">\${colLabel(c)}</th>\`;
      html += "</tr>";
      for (let r = 0; r < ROWS; r++) {
        html += \`<tr><td class="row-num">\${r + 1}</td>\`;
        for (let c = 0; c < COLS; c++) {
          const raw = data[r][c];
          const display = raw.startsWith?.("=") ? evaluate(raw) : raw;
          const isFormula = raw.startsWith?.("=");
          html += \`<td class="\${isFormula ? 'formula-result' : ''}"><input value="\${String(display).replace(/"/g, '&quot;')}" onfocus="selectCell(\${r},\${c})" onblur="updateCell(\${r},\${c},this.value)" data-r="\${r}" data-c="\${c}"></td>\`;
        }
        html += "</tr>";
      }
      table.innerHTML = html;
    }
    function selectCell(r, c) { selectedRow = r; selectedCol = c; document.getElementById("cellRef").value = cellId(r, c); document.getElementById("formulaInput").value = data[r][c]; updateStatus(); }
    function updateCell(r, c, val) { data[r][c] = val; render(); updateStatus(); }
    function applyFormula() { const val = document.getElementById("formulaInput").value; data[selectedRow][selectedCol] = val; render(); }
    function sortByCol(c) { sortCol = c; const rows = data.slice(0, ROWS); rows.sort((a, b) => { const va = a[c], vb = b[c]; const na = parseFloat(va), nb = parseFloat(vb); if (!isNaN(na) && !isNaN(nb)) return na - nb; return String(va).localeCompare(String(vb)); }); for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) data[i][j] = rows[i][j]; render(); document.getElementById("statusInfo").textContent = \`Sorted by column \${colLabel(c)}\`; }
    function sortColumn(asc) { if (sortCol === null) sortCol = selectedCol; const rows = data.slice(0, ROWS); rows.sort((a, b) => { const va = a[sortCol], vb = b[sortCol]; const na = parseFloat(va), nb = parseFloat(vb); if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na; return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)); }); for (let i = 0; i < ROWS; i++) for (let j = 0; j < COLS; j++) data[i][j] = rows[i][j]; render(); }
    function exportCSV() { let csv = ""; for (let r = 0; r < ROWS; r++) { const row = []; for (let c = 0; c < COLS; c++) { const v = data[r][c].startsWith?.("=") ? evaluate(data[r][c]) : data[r][c]; row.push(\`"\${String(v).replace(/"/g, '""')}"\`); } if (row.some(v => v !== '""')) csv += row.join(",") + "\\n"; } const blob = new Blob([csv], { type: "text/csv" }); const a = document.createElement("a"); a.download = "spreadsheet.csv"; a.href = URL.createObjectURL(blob); a.click(); document.getElementById("statusInfo").textContent = "Exported CSV"; }
    function importCSV(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { const lines = e.target.result.split("\\n"); lines.forEach((line, r) => { if (r >= ROWS) return; const cols = line.split(",").map(v => v.replace(/^"|"$/g, "").replace(/""/g, '"')); cols.forEach((val, c) => { if (c < COLS) data[r][c] = val; }); }); render(); document.getElementById("statusInfo").textContent = \`Imported \${lines.length} rows\`; }; reader.readAsText(file); event.target.value = ""; }
    function clearAll() { for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) data[r][c] = ""; render(); document.getElementById("statusInfo").textContent = "Cleared"; }
    function updateStatus() { const filled = data.flat().filter(v => v).length; document.getElementById("selectionInfo").textContent = \`\${cellId(selectedRow, selectedCol)} | \${filled} cells used\`; }
    data[0][0] = "Item"; data[0][1] = "Qty"; data[0][2] = "Price"; data[0][3] = "Total";
    data[1][0] = "Widget A"; data[1][1] = "10"; data[1][2] = "5.99"; data[1][3] = "=B2*C2";
    data[2][0] = "Widget B"; data[2][1] = "25"; data[2][2] = "3.49"; data[2][3] = "=B3*C3";
    data[3][0] = "Widget C"; data[3][1] = "8"; data[3][2] = "12.00"; data[3][3] = "=B4*C4";
    data[4][0] = "Total"; data[4][3] = "=SUM(D2:D4)";
    data[5][0] = "Average"; data[5][3] = "=AVG(D2:D4)";
    data[6][0] = "Count"; data[6][3] = "=COUNT(D2:D4)";
    render(); updateStatus();
  </script>
</body>
</html>`,
      },
    ],
  },
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): { id: string; name: string; description: string; language: string; projectType: string }[] {
  return PROJECT_TEMPLATES.map(({ id, name, description, language, projectType }) => ({ id, name, description, language, projectType: projectType || "web-app" }));
}
