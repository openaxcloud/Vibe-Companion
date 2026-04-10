// Autonomous Builder - Helps non-coders build complete applications
// This module provides AI-powered app building capabilities with comprehensive templates
import { TAILWIND_CDN_HEAD } from './prompts/design-system';

export interface BuildAction {
  type: 'create_file' | 'create_folder' | 'install_package' | 'deploy' | 'run_command';
  data: any;
  // For tracking folder IDs when creating nested structures
  folderRef?: string; // Reference name for created folders
  parentRef?: string; // Reference to parent folder
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  features: string[];
  actions: BuildAction[];
}

export class AutonomousBuilder {
  private templates: Map<string, AppTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  // Initialize comprehensive app templates for non-coders
  private initializeTemplates() {
    // Todo App Template
    this.templates.set('todo-app', {
      id: 'todo-app',
      name: 'Todo List Application',
      description: 'A beautiful task management app with categories and priorities',
      category: 'productivity',
      keywords: ['todo', 'task', 'list', 'productivity', 'organize', 'planner', 'checklist'],
      difficulty: 'beginner',
      estimatedTime: '2 minutes',
      features: ['Add/remove tasks', 'Mark as complete', 'Categories', 'Due dates', 'Priority levels'],
      actions: [
        {
          type: 'create_folder',
          data: { name: 'src', isFolder: true },
          folderRef: 'src'
        },
        {
          type: 'create_folder',
          data: { name: 'components', isFolder: true },
          parentRef: 'src',
          folderRef: 'src/components'
        },
        {
          type: 'create_file',
          data: {
            name: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Todo App</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`
          }
        },
        {
          type: 'create_file',
          data: {
            name: 'package.json',
            content: JSON.stringify({
              name: 'todo-app',
              version: '1.0.0',
              scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview'
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'date-fns': '^2.30.0'
              },
              devDependencies: {
                '@types/react': '^18.2.0',
                '@types/react-dom': '^18.2.0',
                '@vitejs/plugin-react': '^4.0.0',
                'typescript': '^5.0.0',
                'vite': '^4.4.0'
              }
            }, null, 2)
          }
        },
        {
          type: 'create_file',
          parentRef: 'src',
          data: {
            name: 'App.tsx',
            content: `import React, { useState } from 'react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  category: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
}

const priorityColors: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-400',
  low: 'border-l-emerald-500'
};

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [category, setCategory] = useState('personal');
  const [priority, setPriority] = useState<Todo['priority']>('medium');

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, completed: false, category, priority }]);
      setInput('');
    }
  };

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTodo = (id: number) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-8 mb-8 text-center">
        <h1 className="text-3xl font-bold text-white">My Todo List</h1>
        <p className="text-white/80 mt-1">Stay organized, stay productive</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTodo()} placeholder="What needs to be done?" className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl text-base focus:border-[#667eea] focus:outline-none transition" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-3 border-2 border-slate-200 rounded-xl bg-white">
          <option value="personal">Personal</option>
          <option value="work">Work</option>
          <option value="shopping">Shopping</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Todo['priority'])} className="px-4 py-3 border-2 border-slate-200 rounded-xl bg-white">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button onClick={addTodo} className="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-semibold hover:opacity-90 transition">Add</button>
      </div>

      <div className="space-y-3">
        {todos.length === 0 && <p className="text-center text-slate-400 py-12">No tasks yet. Add one above!</p>}
        {todos.map(todo => (
          <div key={todo.id} className={\`flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border-l-4 \${priorityColors[todo.priority]} \${todo.completed ? 'opacity-60' : ''} transition hover:shadow-md\`}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} className="w-5 h-5 rounded accent-[#667eea]" />
            <span className={\`flex-1 text-base \${todo.completed ? 'line-through text-slate-400' : 'text-slate-800'}\`}>{todo.text}</span>
            <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-sm">{todo.category}</span>
            <button onClick={() => deleteTodo(todo.id)} className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}`
          }
        },
        {
          type: 'install_package',
          data: {
            packages: [
              'react',
              'react-dom',
              '@types/react',
              '@types/react-dom',
              'vite',
              '@vitejs/plugin-react',
              'typescript'
            ]
          }
        }
      ]
    });

    // Portfolio Website Template
    this.templates.set('portfolio', {
      id: 'portfolio',
      name: 'Personal Portfolio Website',
      description: 'A professional portfolio to showcase your work and skills',
      category: 'website',
      keywords: ['portfolio', 'website', 'personal', 'resume', 'cv', 'showcase', 'about me'],
      difficulty: 'beginner',
      estimatedTime: '3 minutes',
      features: ['About section', 'Projects gallery', 'Contact form', 'Responsive design', 'Animations'],
      actions: [
        {
          type: 'create_file',
          data: {
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Portfolio</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
  <nav class="fixed w-full top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 shadow-sm">
    <div class="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
      <h1 class="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">Your Name</h1>
      <ul class="flex gap-6 list-none">
        <li><a href="#home" class="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">Home</a></li>
        <li><a href="#about" class="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">About</a></li>
        <li><a href="#projects" class="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">Projects</a></li>
        <li><a href="#contact" class="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">Contact</a></li>
      </ul>
    </div>
  </nav>

  <section id="home" class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white text-center">
    <div class="animate-[fadeIn_1s_ease]">
      <h1 class="text-5xl md:text-6xl font-bold mb-4">Hi, I'm Your Name</h1>
      <p class="text-xl md:text-2xl mb-8 opacity-90">Web Developer & Designer</p>
      <a href="#projects" class="inline-block px-8 py-3 bg-white text-[#667eea] rounded-full font-bold hover:-translate-y-1 transition-transform">View My Work</a>
    </div>
  </section>

  <section id="about" class="py-20 bg-slate-100 dark:bg-slate-800">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-4xl font-bold text-center mb-12 text-slate-800 dark:text-white">About Me</h2>
      <div class="grid md:grid-cols-2 gap-12">
        <div>
          <p class="text-lg text-slate-600 dark:text-slate-300 mb-4">I'm a passionate web developer with experience in creating beautiful and functional websites. I love turning ideas into reality using code.</p>
          <p class="text-lg text-slate-600 dark:text-slate-300">My skills include HTML, CSS, JavaScript, React, and more. I'm always eager to learn new technologies and take on challenging projects.</p>
        </div>
        <div>
          <h3 class="text-xl font-semibold mb-4 text-slate-800 dark:text-white">My Skills</h3>
          <div class="flex flex-wrap gap-3">
            <span class="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-2 rounded-full text-sm font-medium">HTML/CSS</span>
            <span class="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-2 rounded-full text-sm font-medium">JavaScript</span>
            <span class="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-2 rounded-full text-sm font-medium">React</span>
            <span class="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-2 rounded-full text-sm font-medium">Node.js</span>
            <span class="bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-4 py-2 rounded-full text-sm font-medium">Design</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="projects" class="py-20">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-4xl font-bold text-center mb-12 text-slate-800 dark:text-white">My Projects</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg hover:-translate-y-2 transition-transform">
          <div class="h-48 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
            <svg class="w-16 h-16 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold mb-2">Project One</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">A brief description of your first project and the technologies used.</p>
            <a href="#" class="text-[#667eea] font-semibold hover:underline">View Project &rarr;</a>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg hover:-translate-y-2 transition-transform">
          <div class="h-48 bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
            <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold mb-2">Project Two</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">A brief description of your second project and what makes it special.</p>
            <a href="#" class="text-[#667eea] font-semibold hover:underline">View Project &rarr;</a>
          </div>
        </div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg hover:-translate-y-2 transition-transform">
          <div class="h-48 bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <svg class="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          </div>
          <div class="p-6">
            <h3 class="text-xl font-bold mb-2">Project Three</h3>
            <p class="text-slate-600 dark:text-slate-400 mb-4">A brief description of your third project and its key features.</p>
            <a href="#" class="text-[#667eea] font-semibold hover:underline">View Project &rarr;</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="contact" class="py-20 bg-slate-100 dark:bg-slate-800">
    <div class="max-w-6xl mx-auto px-6">
      <h2 class="text-4xl font-bold text-center mb-12 text-slate-800 dark:text-white">Get In Touch</h2>
      <form class="max-w-xl mx-auto flex flex-col gap-4">
        <input type="text" placeholder="Your Name" required class="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:border-[#667eea] focus:outline-none transition">
        <input type="email" placeholder="Your Email" required class="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:border-[#667eea] focus:outline-none transition">
        <textarea placeholder="Your Message" rows="5" required class="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 dark:bg-slate-700 focus:border-[#667eea] focus:outline-none transition resize-none"></textarea>
        <button type="submit" class="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-xl font-semibold hover:opacity-90 transition text-lg">Send Message</button>
      </form>
    </div>
  </section>

  <footer class="bg-slate-900 text-white text-center py-8">
    <p class="text-slate-400">&copy; 2024 Your Name. All rights reserved.</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>`
          }
        }
      ]
    });

    // Blog Website Template
    this.templates.set('blog', {
      id: 'blog',
      name: 'Blog Website',
      description: 'A modern blog platform with articles and comments',
      category: 'website',
      keywords: ['blog', 'article', 'writing', 'journal', 'news', 'magazine'],
      difficulty: 'intermediate',
      estimatedTime: '4 minutes',
      features: ['Article listing', 'Full article view', 'Categories', 'Search', 'Comments'],
      actions: [
        {
          type: 'create_folder',
          data: { path: 'src' }
        },
        {
          type: 'create_file',
          data: {
            path: 'package.json',
            content: JSON.stringify({
              name: 'blog-website',
              version: '1.0.0',
              scripts: {
                dev: 'vite',
                build: 'vite build'
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'react-router-dom': '^6.0.0',
                'react-markdown': '^8.0.0'
              },
              devDependencies: {
                '@types/react': '^18.2.0',
                '@vitejs/plugin-react': '^4.0.0',
                'typescript': '^5.0.0',
                'vite': '^4.4.0'
              }
            }, null, 2)
          }
        },
        {
          type: 'create_file',
          data: {
            path: 'src/App.tsx',
            content: `import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ArticlePage from './pages/ArticlePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
        <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 shadow-sm">
          <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">My Blog</h1>
            <nav className="flex gap-6">
              <a href="/" className="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">Home</a>
              <a href="/about" className="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">About</a>
              <a href="/contact" className="text-slate-600 dark:text-slate-300 hover:text-[#667eea] font-medium transition">Contact</a>
            </nav>
          </div>
        </header>
        
        <main className="max-w-5xl mx-auto px-6 py-12">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:id" element={<ArticlePage />} />
          </Routes>
        </main>
        
        <footer className="bg-slate-900 text-center py-8">
          <p className="text-slate-400">&copy; 2024 My Blog. All rights reserved.</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}`
          }
        },
        {
          type: 'install_package',
          data: {
            packages: ['react', 'react-dom', 'react-router-dom', 'react-markdown', 'vite']
          }
        }
      ]
    });

    // E-commerce Store Template
    this.templates.set('ecommerce', {
      id: 'ecommerce',
      name: 'E-commerce Store',
      description: 'An online store with products, cart, and checkout',
      category: 'business',
      keywords: ['shop', 'store', 'ecommerce', 'selling', 'products', 'online store', 'marketplace'],
      difficulty: 'intermediate',
      estimatedTime: '5 minutes',
      features: ['Product catalog', 'Shopping cart', 'Search & filters', 'Checkout', 'User accounts'],
      actions: [
        {
          type: 'create_folder',
          data: { name: 'src', isFolder: true },
          folderRef: 'src'
        },
        {
          type: 'create_folder',
          data: { name: 'components', isFolder: true },
          parentRef: 'src',
          folderRef: 'src/components'
        },
        {
          type: 'create_folder',
          data: { name: 'data', isFolder: true },
          parentRef: 'src',
          folderRef: 'src/data'
        },
        {
          type: 'create_file',
          data: {
            name: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Online Store</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`
          }
        },
        {
          type: 'create_file',
          data: {
            name: 'package.json',
            content: JSON.stringify({
              name: 'ecommerce-store',
              version: '1.0.0',
              private: true,
              scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview'
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0'
              },
              devDependencies: {
                '@types/react': '^18.2.0',
                '@types/react-dom': '^18.2.0',
                '@vitejs/plugin-react': '^4.2.0',
                typescript: '^5.3.0',
                vite: '^5.0.0'
              }
            }, null, 2)
          }
        },
        {
          type: 'create_file',
          parentRef: 'src',
          data: {
            name: 'main.tsx',
            content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src',
          data: {
            name: 'types.ts',
            content: `export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  tags: string[];
  rating: number;
  inventory: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface FilterOption {
  label: string;
  value: string;
}`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src/data',
          data: {
            name: 'products.ts',
            content: `import type { Product } from '../types';

export const products: Product[] = [
  {
    id: 'starter-kit',
    name: 'Developer Starter Kit',
    description: 'All the essentials for modern web development in one bundle.',
    price: 129,
    category: 'Bundles',
    image: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?auto=format&fit=crop&w=800&q=80',
    tags: ['popular', 'bestseller'],
    rating: 4.9,
    inventory: 24
  },
  {
    id: 'design-tokens',
    name: 'Premium Design Tokens',
    description: 'Beautiful, accessible design tokens for lightning-fast prototyping.',
    price: 89,
    category: 'UI Kits',
    image: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80',
    tags: ['new'],
    rating: 4.7,
    inventory: 46
  },
  {
    id: 'ai-copilot',
    name: 'AI Coding Copilot',
    description: 'Smart pair-programmer that accelerates your development workflow.',
    price: 199,
    category: 'AI Tools',
    image: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=800&q=80',
    tags: ['ai'],
    rating: 4.8,
    inventory: 12
  },
  {
    id: 'cloud-hosting',
    name: 'Cloud Hosting Credits',
    description: 'Scalable hosting credits that grow alongside your project.',
    price: 59,
    category: 'Infrastructure',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    tags: ['featured'],
    rating: 4.6,
    inventory: 64
  }
];

export const categories = Array.from(new Set(products.map((product) => product.category)));`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src/components',
          data: {
            name: 'ProductCard.tsx',
            content: `import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAddToCart: (productId: string) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const badge = product.tags[0];

  return (
    <article className="product-card">
      <div className="product-image" role="presentation">
        <img src={product.image} alt="" />
        {badge ? <span className="product-badge">{badge}</span> : null}
      </div>
      <div className="product-content">
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="product-meta">
          <span className="product-price">\${product.price.toFixed(2)}</span>
          <span className="product-rating">★ {product.rating.toFixed(1)}</span>
        </div>
      </div>
      <button className="add-to-cart" onClick={() => onAddToCart(product.id)}>
        Add to cart
      </button>
    </article>
  );
}`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src/components',
          data: {
            name: 'CartSummary.tsx',
            content: `import type { CartItem } from '../types';

interface CartSummaryProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  onIncrement: (productId: string) => void;
  onDecrement: (productId: string) => void;
  onRemove: (productId: string) => void;
}

export function CartSummary({
  items,
  subtotal,
  discount,
  total,
  onIncrement,
  onDecrement,
  onRemove
}: CartSummaryProps) {
  if (items.length === 0) {
    return (
      <aside className="cart empty">
        <h2>Your cart</h2>
        <p>Start adding products to see them here.</p>
      </aside>
    );
  }

  return (
    <aside className="cart">
      <h2>Your cart</h2>
      <ul className="cart-items">
        {items.map((item) => (
          <li key={item.product.id} className="cart-item">
            <div>
              <p className="cart-item-name">{item.product.name}</p>
              <p className="cart-item-price">\${item.product.price.toFixed(2)}</p>
            </div>
            <div className="cart-item-controls">
              <button onClick={() => onDecrement(item.product.id)} aria-label="Decrease quantity">
                –
              </button>
              <span aria-live="polite">{item.quantity}</span>
              <button onClick={() => onIncrement(item.product.id)} aria-label="Increase quantity">
                +
              </button>
              <button className="remove" onClick={() => onRemove(item.product.id)}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>\${subtotal.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span>Discount</span>
          <span>- \${discount.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total</span>
          <span>\${total.toFixed(2)}</span>
        </div>
        <button className="checkout">Proceed to checkout</button>
      </div>
    </aside>
  );
}`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src',
          data: {
            name: 'App.tsx',
            content: `import { useMemo, useState } from 'react';
import './App.css';
import { categories, products } from './data/products';
import type { CartItem } from './types';
import { ProductCard } from './components/ProductCard';
import { CartSummary } from './components/CartSummary';

type CartState = Record<string, number>;

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [cart, setCart] = useState<CartState>({});

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'All' ? true : product.category === activeCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchTerm]);

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, quantity]) => {
        const product = products.find((item) => item.id === productId);
        if (!product) {
          return null;
        }

        return { product, quantity };
      })
      .filter((item): item is CartItem => item !== null);
  }, [cart]);

  const subtotal = cartItems.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );
  const discount = subtotal > 150 ? subtotal * 0.1 : 0;
  const total = subtotal - discount;

  const addToCart = (productId: string) => {
    setCart((previous) => ({
      ...previous,
      [productId]: (previous[productId] ?? 0) + 1
    }));
  };

  const decrementItem = (productId: string) => {
    setCart((previous) => {
      const quantity = previous[productId] ?? 0;
      if (quantity <= 1) {
        const { [productId]: _removed, ...rest } = previous;
        return rest;
      }

      return { ...previous, [productId]: quantity - 1 };
    });
  };

  const incrementItem = (productId: string) => {
    setCart((previous) => ({
      ...previous,
      [productId]: (previous[productId] ?? 0) + 1
    }));
  };

  const removeItem = (productId: string) => {
    setCart((previous) => {
      const { [productId]: _removed, ...rest } = previous;
      return rest;
    });
  };

  const allCategories = ['All', ...categories];

  return (
    <div className="app-shell">
      <header className="store-header">
        <div>
          <h1>Atlas Supply</h1>
          <p>Your curated marketplace for developer essentials.</p>
        </div>
        <div className="search-group">
          <input
            type="search"
            placeholder="Search products"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </header>

      <section className="content">
        <div className="filters" role="navigation" aria-label="Product filters">
          {allCategories.map((category) => {
            const isActive = category === activeCategory;
            const classes = ['filter-chip'];
            if (isActive) {
              classes.push('active');
            }

            return (
              <button
                key={category}
                className={classes.join(' ')}
                onClick={() => setActiveCategory(category)}
                aria-pressed={isActive}
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="layout">
          <main className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </main>

          <CartSummary
            items={cartItems}
            subtotal={subtotal}
            discount={discount}
            total={total}
            onIncrement={incrementItem}
            onDecrement={decrementItem}
            onRemove={removeItem}
          />
        </div>
      </section>
    </div>
  );
}`
          }
        },
        {
          type: 'create_file',
          parentRef: 'src',
          data: {
            name: 'App.css',
            content: `:root {
  color: #101828;
  background-color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: radial-gradient(circle at top, #f4f3ff 0%, #f8fafc 40%);
  min-height: 100vh;
}

.app-shell {
  max-width: 1200px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.store-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.store-header h1 {
  margin: 0;
  font-size: 2.5rem;
  letter-spacing: -0.04em;
}

.store-header p {
  margin: 0.5rem 0 0;
  color: #475467;
}

.search-group input {
  width: 240px;
  padding: 0.75rem 1rem;
  border-radius: 9999px;
  border: 1px solid #d0d5dd;
  background: #ffffff;
  font-size: 0.95rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-chip {
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  border: 1px solid #d0d5dd;
  background: rgba(255, 255, 255, 0.9);
  color: #344054;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip:hover {
  border-color: #7f56d9;
  color: #7f56d9;
}

.filter-chip.active {
  background: linear-gradient(120deg, #7f56d9 0%, #9e77ed 100%);
  border-color: transparent;
  color: white;
  box-shadow: 0 10px 30px rgba(126, 86, 217, 0.25);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 2rem;
  align-items: start;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}

.product-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 20px 40px rgba(93, 95, 239, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  overflow: hidden;
}

.product-image img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 18px;
}

.product-badge {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  background: rgba(16, 24, 40, 0.85);
  color: white;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
}

.product-content h3 {
  margin: 0;
  font-size: 1.25rem;
}

.product-content p {
  margin: 0;
  color: #475467;
  line-height: 1.5;
}

.product-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.product-price {
  font-size: 1.1rem;
  font-weight: 600;
}

.product-rating {
  color: #f79009;
  font-weight: 600;
}

.add-to-cart {
  margin-top: auto;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(120deg, #7f56d9 0%, #9e77ed 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.add-to-cart:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 30px rgba(126, 86, 217, 0.25);
}

.cart {
  background: #ffffff;
  border-radius: 24px;
  padding: 1.75rem;
  box-shadow: 0 20px 40px rgba(93, 95, 239, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cart h2 {
  margin: 0;
}

.cart.empty {
  text-align: center;
  color: #475467;
  font-size: 0.95rem;
}

.cart-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cart-item-name {
  margin: 0;
  font-weight: 600;
}

.cart-item-price {
  margin: 0.25rem 0 0;
  color: #475467;
  font-size: 0.9rem;
}

.cart-item-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cart-item-controls button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid #d0d5dd;
  background: white;
  font-size: 1.1rem;
  cursor: pointer;
}

.cart-item-controls .remove {
  background: transparent;
  color: #d92d20;
  border: none;
  font-size: 0.85rem;
  font-weight: 600;
}

.cart-summary {
  border-top: 1px solid #e4e7ec;
  padding-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #475467;
}

.summary-row.total {
  font-size: 1.1rem;
  font-weight: 600;
  color: #101828;
}

.checkout {
  width: 100%;
  padding: 0.85rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(120deg, #10b981 0%, #22c55e 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .cart {
    position: sticky;
    bottom: 1rem;
  }
}

@media (max-width: 640px) {
  .store-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-group input {
    width: 100%;
  }

  .product-grid {
    grid-template-columns: 1fr;
  }
}`
          }
        },
        {
          type: 'create_file',
          data: {
            name: 'tsconfig.json',
            content: JSON.stringify({
              compilerOptions: {
                target: 'ES2020',
                useDefineForClassFields: true,
                lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                moduleResolution: 'Node',
                strict: true,
                jsx: 'react-jsx',
                types: ['vite/client'],
                baseUrl: '.',
                paths: {
                  src: ['./src']
                }
              },
              include: ['src']
            }, null, 2)
          }
        },
        {
          type: 'create_file',
          data: {
            name: 'vite.config.ts',
            content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
});`
          }
        },
        {
          type: 'install_package',
          data: {
            packages: [
              'react',
              'react-dom',
              '@types/react',
              '@types/react-dom',
              'vite',
              '@vitejs/plugin-react',
              'typescript'
            ]
          }
        }
      ]
    });

    // Chat Application Template
    this.templates.set('chat-app', {
      id: 'chat-app',
      name: 'Real-time Chat Application',
      description: 'A messaging app with rooms and real-time updates',
      category: 'social',
      keywords: ['chat', 'messaging', 'communication', 'real-time', 'websocket'],
      difficulty: 'advanced',
      estimatedTime: '6 minutes',
      features: ['Real-time messaging', 'Multiple rooms', 'User presence', 'Message history', 'Emojis'],
      actions: [
        // Chat app template actions...
      ]
    });
  }

  // Detect what type of app the user wants to build from their description
  detectAppType(description: string): AppTemplate | null {
    const lowercaseDesc = description.toLowerCase();
    
    // Check each template's keywords
    for (const template of Array.from(this.templates.values())) {
      const keywordMatches = template.keywords.filter((keyword: string) => 
        lowercaseDesc.includes(keyword)
      ).length;
      
      if (keywordMatches >= 2) {
        return template;
      }
    }

    // Fallback pattern matching
    if (lowercaseDesc.includes('todo') || lowercaseDesc.includes('task')) {
      return this.templates.get('todo-app')!;
    }
    if (lowercaseDesc.includes('portfolio') || lowercaseDesc.includes('resume')) {
      return this.templates.get('portfolio')!;
    }
    if (lowercaseDesc.includes('blog') || lowercaseDesc.includes('article')) {
      return this.templates.get('blog')!;
    }
    if (lowercaseDesc.includes('shop') || lowercaseDesc.includes('store')) {
      return this.templates.get('ecommerce')!;
    }
    if (lowercaseDesc.includes('chat') || lowercaseDesc.includes('message')) {
      return this.templates.get('chat-app')!;
    }

    return null;
  }

  // Generate build actions based on user's description (legacy method)
  generateBuildActions(description: string): BuildAction[] {
    const template = this.detectAppType(description);
    
    if (template) {
      return template.actions;
    }

    // If no template matches, generate basic web app structure
    return this.generateBasicWebApp(description);
  }

  // Generate a basic web app structure when no template matches
  private generateBasicWebApp(description: string): BuildAction[] {
    return [
      {
        type: 'create_file',
        data: {
          path: 'index.html',
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${description}</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <nav class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <h1 class="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">${description}</h1>
    </div>
  </nav>

  <main>
    <section class="min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
      <div class="max-w-4xl mx-auto px-4 text-center animate-fade-in">
        <h2 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">Welcome to Your App</h2>
        <p class="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">This is your new ${description} application.</p>
        <button class="bg-white text-[#667eea] px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200" onclick="document.getElementById('app').scrollIntoView({behavior:'smooth'})">Get Started</button>
      </div>
    </section>

    <section class="py-16 sm:py-24">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div id="app" class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 animate-fade-in-delay-1">
          <p class="text-base leading-relaxed text-slate-600 dark:text-slate-300">Your app is ready to be customized!</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-slate-900 text-white py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p class="text-slate-400 text-sm">&copy; 2024 ${description}. All rights reserved.</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`
        }
      },
      {
        type: 'create_file',
        data: {
          path: 'style.css',
          content: `/* Tailwind CSS is loaded via CDN - this file is for additional custom styles only */`
        }
      },
      {
        type: 'create_file',
        data: {
          path: 'script.js',
          content: `console.log('App is running!');
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<p class="text-base leading-relaxed text-slate-600 dark:text-slate-300">Your app is ready to be customized!</p>';
  }
});`
        }
      }
    ];
  }

  // Get all available templates
  getTemplates(): AppTemplate[] {
    return Array.from(this.templates.values());
  }

  // Get template by ID
  getTemplate(id: string): AppTemplate | undefined {
    return this.templates.get(id);
  }

  // Detect building intent from user message
  detectBuildingIntent(message: string): { 
    detected: boolean; 
    matchedTemplate?: string; 
    confidence: number; 
    buildingKeywords: string[]; 
    appType?: string 
  } {
    const lowerMessage = message.toLowerCase();
    
    // Building keywords to detect intent
    const buildingKeywords = ['build', 'create', 'make', 'develop', 'generate', 'design', 'craft', 'construct'];
    const detectedKeywords = buildingKeywords.filter(keyword => lowerMessage.includes(keyword));
    
    // App type keywords
    const appTypeKeywords = ['app', 'application', 'website', 'site', 'tool', 'service', 'platform', 'system'];
    const hasAppType = appTypeKeywords.some(keyword => lowerMessage.includes(keyword));
    
    // Check if building intent is detected
    const hasBuilding = detectedKeywords.length > 0;
    const detected = hasBuilding || hasAppType;
    
    if (!detected) {
      return {
        detected: false,
        confidence: 0,
        buildingKeywords: []
      };
    }
    
    // Try to match with existing templates
    let matchedTemplate: string | undefined;
    let highestConfidence = 0;
    
    for (const [templateId, template] of Array.from(this.templates.entries())) {
      const matches = template.keywords.filter((keyword: string) => 
        lowerMessage.includes(keyword.toLowerCase())
      ).length;
      
      const confidence = matches / template.keywords.length;
      
      if (confidence > highestConfidence && confidence >= 0.3) {
        highestConfidence = confidence;
        matchedTemplate = templateId;
      }
    }
    
    // Determine app type
    let appType = 'web-app';
    if (lowerMessage.includes('todo') || lowerMessage.includes('task')) appType = 'todo-app';
    else if (lowerMessage.includes('portfolio') || lowerMessage.includes('resume')) appType = 'portfolio';
    else if (lowerMessage.includes('blog') || lowerMessage.includes('article')) appType = 'blog';
    else if (lowerMessage.includes('shop') || lowerMessage.includes('store') || lowerMessage.includes('ecommerce')) appType = 'ecommerce';
    else if (lowerMessage.includes('chat') || lowerMessage.includes('message')) appType = 'chat-app';
    else if (lowerMessage.includes('dashboard') || lowerMessage.includes('analytics')) appType = 'dashboard';
    else if (lowerMessage.includes('game') || lowerMessage.includes('gaming')) appType = 'game';
    
    return {
      detected: true,
      matchedTemplate,
      confidence: Math.max(highestConfidence, hasBuilding ? 0.7 : 0.5),
      buildingKeywords: detectedKeywords,
      appType
    };
  }

  // Generate comprehensive build actions and response
  async generateComprehensiveBuildActions(
    message: string, 
    buildingIntent: any, 
    language: string = 'javascript'
  ): Promise<{ actions: BuildAction[]; response: string }> {
    
    // If we have a matched template, use it
    if (buildingIntent.matchedTemplate) {
      const template = this.templates.get(buildingIntent.matchedTemplate);
      if (template) {
        return {
          actions: template.actions,
          response: `I'm building a ${template.name} for you! ${template.description}. This will include: ${template.features.join(', ')}.`
        };
      }
    }
    
    // Generate based on app type
    const appType = buildingIntent.appType || 'web-app';
    let actions: BuildAction[] = [];
    let response = "";
    
    switch (appType) {
      case 'todo-app':
        actions = this.templates.get('todo-app')?.actions || [];
        response = "I'm building a Todo app for you! It will have task management, categories, and a beautiful interface.";
        break;
        
      case 'portfolio':
        actions = [
          { type: 'create_file', data: { path: 'index.html', content: this.generatePortfolioHTML() }},
          { type: 'create_file', data: { path: 'script.js', content: this.generatePortfolioJS() }}
        ];
        response = "I'm creating a professional portfolio website for you! It will showcase your work with a modern, responsive design using Tailwind CSS.";
        break;
        
      case 'blog':
        actions = [
          { type: 'create_file', data: { path: 'index.html', content: this.generateBlogHTML() }},
          { type: 'create_file', data: { path: 'script.js', content: this.generateBlogJS() }}
        ];
        response = "I'm building a blog for you! It will have article management, categories, and a clean reading experience with Tailwind CSS.";
        break;
        
      case 'dashboard':
        actions = [
          { type: 'create_file', data: { path: 'index.html', content: this.generateDashboardHTML() }},
          { type: 'create_file', data: { path: 'script.js', content: this.generateDashboardJS() }}
        ];
        response = "I'm creating an analytics dashboard for you! It will display data visualizations, metrics, and interactive charts with Tailwind CSS.";
        break;
        
      default:
        actions = this.generateBasicWebApp(message);
        response = "I'm building a custom web application for you! It will have a modern interface and be ready for customization.";
    }
    
    return { actions, response };
  }

  private generatePortfolioHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Portfolio</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <nav class="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <h1 class="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">Your Name</h1>
      <ul class="flex gap-6">
        <li><a href="#about" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">About</a></li>
        <li><a href="#projects" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">Projects</a></li>
        <li><a href="#contact" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">Contact</a></li>
      </ul>
    </div>
  </nav>

  <main class="pt-16">
    <section id="hero" class="min-h-[70vh] flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
      <div class="max-w-4xl mx-auto px-4 text-center animate-fade-in">
        <h2 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">Hello, I'm a Creative Developer</h2>
        <p class="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">I build amazing digital experiences with modern technologies</p>
        <a href="#projects" class="inline-block bg-white text-[#667eea] px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200">View My Work</a>
      </div>
    </section>

    <section id="about" class="py-16 sm:py-24">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-center mb-8 animate-fade-in">About Me</h2>
        <div class="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-200 animate-fade-in-delay-1">
          <p class="text-base leading-relaxed text-slate-600 dark:text-slate-300">I'm passionate about creating innovative solutions and beautiful user experiences. With expertise in modern web technologies, I craft digital products that delight users and drive results.</p>
        </div>
      </div>
    </section>

    <section id="projects" class="py-16 sm:py-24 bg-slate-100 dark:bg-slate-800/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-center mb-12 animate-fade-in">My Projects</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-1">
            <div class="h-40 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-xl mb-4"></div>
            <h3 class="text-xl font-semibold mb-2">Project 1</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Description of your awesome project</p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-2">
            <div class="h-40 bg-gradient-to-br from-[#06b6d4] to-[#667eea] rounded-xl mb-4"></div>
            <h3 class="text-xl font-semibold mb-2">Project 2</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Description of another great project</p>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-3">
            <div class="h-40 bg-gradient-to-br from-[#764ba2] to-[#f59e0b] rounded-xl mb-4"></div>
            <h3 class="text-xl font-semibold mb-2">Project 3</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">Yet another incredible project</p>
          </div>
        </div>
      </div>
    </section>

    <section id="contact" class="py-16 sm:py-24">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl sm:text-4xl font-bold mb-4 animate-fade-in">Get In Touch</h2>
        <p class="text-slate-600 dark:text-slate-300 mb-8 animate-fade-in-delay-1">Let's work together on something amazing!</p>
        <a href="mailto:hello@example.com" class="inline-block bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white px-8 py-4 rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 animate-fade-in-delay-2">Contact Me</a>
      </div>
    </section>
  </main>

  <footer class="bg-slate-900 text-white py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p class="text-slate-400 text-sm">&copy; 2024 Your Name. All rights reserved.</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;
  }

  private generatePortfolioCSS(): string {
    return `/* Tailwind CSS is loaded via CDN - this file is for additional custom styles only */`;
  }

  private generatePortfolioJS(): string {
    return `document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

// Add scroll effect to header
window.addEventListener('scroll', () => {
  const header = document.querySelector('header');
  if (window.scrollY > 100) {
    header.style.background = 'rgba(255, 255, 255, 0.95)';
    header.style.backdropFilter = 'blur(10px)';
  } else {
    header.style.background = '#fff';
    header.style.backdropFilter = 'none';
  }
});`;
  }

  // Generate blog HTML
  private generateBlogHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Blog</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen">
  <nav class="fixed top-0 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 z-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
      <h1 class="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">My Blog</h1>
      <div class="flex gap-6">
        <a href="#home" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">Home</a>
        <a href="#about" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">About</a>
        <a href="#categories" class="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-[#667eea] transition-colors duration-200">Categories</a>
      </div>
    </div>
  </nav>

  <main class="pt-16">
    <section class="min-h-[50vh] flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
      <div class="max-w-4xl mx-auto px-4 text-center animate-fade-in">
        <h2 class="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">Welcome to My Blog</h2>
        <p class="text-lg text-white/80 max-w-2xl mx-auto">Sharing thoughts, ideas, and experiences</p>
      </div>
    </section>

    <section class="py-16 sm:py-24">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl sm:text-4xl font-bold text-center mb-12 animate-fade-in">Latest Posts</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <article class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-1">
            <div class="h-48 bg-gradient-to-br from-[#667eea] to-[#06b6d4]"></div>
            <div class="p-6">
              <div class="flex items-center gap-2 mb-3">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#667eea]/10 text-[#667eea]">Technology</span>
                <span class="text-xs text-slate-500">January 1, 2024 &bull; 3 min read</span>
              </div>
              <h3 class="text-xl font-semibold mb-2">My First Blog Post</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">This is where your blog post content would go. Write about anything you're passionate about!</p>
              <a href="#" class="text-sm font-semibold text-[#667eea] hover:text-[#764ba2] transition-colors duration-200">Read More &rarr;</a>
            </div>
          </article>
          <article class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-2">
            <div class="h-48 bg-gradient-to-br from-[#764ba2] to-[#f59e0b]"></div>
            <div class="p-6">
              <div class="flex items-center gap-2 mb-3">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#764ba2]/10 text-[#764ba2]">Design</span>
                <span class="text-xs text-slate-500">January 5, 2024 &bull; 5 min read</span>
              </div>
              <h3 class="text-xl font-semibold mb-2">Another Interesting Article</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Share your knowledge, experiences, and insights with your readers through engaging content.</p>
              <a href="#" class="text-sm font-semibold text-[#667eea] hover:text-[#764ba2] transition-colors duration-200">Read More &rarr;</a>
            </div>
          </article>
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-slate-900 text-white py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p class="text-slate-400 text-sm">&copy; 2024 My Blog. All rights reserved.</p>
    </div>
  </footer>

  <script src="script.js"></script>
</body>
</html>`;
  }

  private generateBlogCSS(): string {
    return `/* Tailwind CSS is loaded via CDN - this file is for additional custom styles only */`;
  }

  private generateBlogJS(): string {
    return `document.querySelectorAll('nav a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});`;
  }

  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Analytics Dashboard</title>
  ${TAILWIND_CDN_HEAD}
</head>
<body class="bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white min-h-screen flex">
  <aside class="w-64 bg-slate-900 text-white min-h-screen p-6 hidden md:block">
    <h2 class="text-xl font-bold mb-8 bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">Dashboard</h2>
    <nav class="space-y-2">
      <a href="#overview" class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 text-white font-medium transition-all duration-200 hover:bg-white/20">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        Overview
      </a>
      <a href="#analytics" class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
        Analytics
      </a>
      <a href="#reports" class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        Reports
      </a>
      <a href="#settings" class="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 font-medium transition-all duration-200 hover:bg-white/10 hover:text-white">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        Settings
      </a>
    </nav>
  </aside>

  <main class="flex-1 p-6 lg:p-8 overflow-y-auto">
    <header class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
      <h1 class="text-2xl sm:text-3xl font-bold animate-fade-in">Analytics Overview</h1>
      <select class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#667eea] focus:border-transparent outline-none transition-all duration-200" aria-label="Date range">
        <option>Last 7 days</option>
        <option>Last 30 days</option>
        <option>Last 90 days</option>
      </select>
    </header>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in">
        <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Total Users</h3>
        <div class="text-3xl font-extrabold mb-1">12,345</div>
        <span class="inline-flex items-center text-sm font-medium text-emerald-500">+12.5%</span>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-1">
        <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Revenue</h3>
        <div class="text-3xl font-extrabold mb-1">$45,678</div>
        <span class="inline-flex items-center text-sm font-medium text-emerald-500">+8.2%</span>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-2">
        <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Conversion Rate</h3>
        <div class="text-3xl font-extrabold mb-1">3.45%</div>
        <span class="inline-flex items-center text-sm font-medium text-red-500">-2.1%</span>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl hover:scale-[1.02] transition-all duration-200 animate-fade-in-delay-3">
        <h3 class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Bounce Rate</h3>
        <div class="text-3xl font-extrabold mb-1">65.2%</div>
        <span class="inline-flex items-center text-sm font-medium text-emerald-500">-5.3%</span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-200">
        <h3 class="text-lg font-semibold mb-4">Traffic Overview</h3>
        <div class="h-64 bg-gradient-to-br from-[#667eea]/5 to-[#764ba2]/5 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-700">
          <p class="text-slate-400 text-sm">Interactive chart area</p>
        </div>
      </div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-200">
        <h3 class="text-lg font-semibold mb-4">Top Pages</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600 dark:text-slate-300">/home</span>
            <div class="flex items-center gap-2">
              <div class="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-[#667eea] rounded-full" style="width:45%"></div></div>
              <span class="text-sm font-medium">45%</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600 dark:text-slate-300">/products</span>
            <div class="flex items-center gap-2">
              <div class="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-[#764ba2] rounded-full" style="width:23%"></div></div>
              <span class="text-sm font-medium">23%</span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-600 dark:text-slate-300">/about</span>
            <div class="flex items-center gap-2">
              <div class="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-[#06b6d4] rounded-full" style="width:15%"></div></div>
              <span class="text-sm font-medium">15%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script src="script.js"></script>
</body>
</html>`;
  }

  private generateDashboardCSS(): string {
    return `/* Tailwind CSS is loaded via CDN - this file is for additional custom styles only */`;
  }

  private generateDashboardJS(): string {
    return `document.querySelectorAll('aside nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('aside nav a').forEach(l => {
      l.classList.remove('bg-white/10', 'text-white');
      l.classList.add('text-slate-400');
    });
    link.classList.add('bg-white/10', 'text-white');
    link.classList.remove('text-slate-400');
    const section = link.getAttribute('href').substring(1);
    const header = document.querySelector('main h1');
    const titles = { overview: 'Analytics Overview', analytics: 'Detailed Analytics', reports: 'Reports', settings: 'Settings' };
    if (header) header.textContent = titles[section] || section;
  });
});`;
  }
}

export const autonomousBuilder = new AutonomousBuilder();