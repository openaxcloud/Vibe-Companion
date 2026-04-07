import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ScrollArea,
  ScrollBar
} from "@/components/ui/scroll-area";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Code, File, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LanguageTemplatesProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  files: { name: string; content: string }[];
  dependencies: string[];
}

export function LanguageTemplates({ 
  isOpen, 
  onClose,
  onSelectTemplate 
}: LanguageTemplatesProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState("");
  const { toast } = useToast();
  
  // Mock template data
  const templates: Template[] = [
    {
      id: "html-basic",
      name: "HTML Static Website",
      description: "Basic HTML, CSS, and JavaScript template for static websites",
      language: "html",
      category: "frontend",
      files: [
        { 
          name: "index.html", 
          content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Website</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Welcome to My Website</h1>
  </header>
  
  <main>
    <p>This is a starter template for your website.</p>
  </main>
  
  <footer>
    <p>&copy; 2025 My Website</p>
  </footer>
  
  <script src="script.js"></script>
</body>
</html>` 
        },
        { 
          name: "styles.css", 
          content: `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 0;
}

header {
  background-color: #f5f5f5;
  padding: 20px;
  text-align: center;
}

main {
  padding: 20px;
}

footer {
  background-color: #f5f5f5;
  padding: 10px 20px;
  text-align: center;
}` 
        },
        { 
          name: "script.js", 
          content: `// Your JavaScript code here
document.addEventListener('DOMContentLoaded', function() {
  console.log('Document loaded!');
});` 
        }
      ],
      dependencies: []
    },
    {
      id: "react-app",
      name: "React Application",
      description: "Modern React application with TypeScript and Vite",
      language: "typescript",
      category: "frontend",
      files: [
        { 
          name: "src/App.tsx", 
          content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <header className="App-header">
        <h1>Vite + React</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>
      </header>
    </div>
  )
}

export default App` 
        }
      ],
      dependencies: ["react", "react-dom", "typescript"]
    },
    {
      id: "express-api",
      name: "Express API",
      description: "RESTful API server with Express and Node.js",
      language: "javascript",
      category: "backend",
      files: [
        { 
          name: "server.js", 
          content: `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

app.get('/api/items', (req, res) => {
  // Sample data
  const items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
  ];
  
  res.json(items);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});` 
        },
        { 
          name: "package.json", 
          content: `{
  "name": "express-api",
  "version": "1.0.0",
  "description": "Express API Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}` 
        }
      ],
      dependencies: ["express", "nodemon"]
    },
    {
      id: "python-flask",
      name: "Python Flask App",
      description: "Web application with Flask framework",
      language: "python",
      category: "backend",
      files: [
        { 
          name: "app.py", 
          content: `from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Welcome to Flask API"})

@app.route('/api/items')
def get_items():
    items = [
        {"id": 1, "name": "Item 1"},
        {"id": 2, "name": "Item 2"}
    ]
    return jsonify(items)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')` 
        },
        { 
          name: "requirements.txt", 
          content: `flask==2.3.2` 
        }
      ],
      dependencies: ["flask"]
    },
    {
      id: "fullstack-nodejs",
      name: "Fullstack Node.js App",
      description: "Node.js with Express backend and React frontend",
      language: "javascript",
      category: "fullstack",
      files: [
        { 
          name: "server/index.js", 
          content: `const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API routes
app.get('/api/data', (req, res) => {
  res.json({ message: 'API working!' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});` 
        }
      ],
      dependencies: ["express", "react", "react-dom"]
    },
  ];
  
  // Filter templates by search query and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.language.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'all' || template.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  const handleCreateProject = () => {
    if (!selectedTemplate) return;
    
    if (!projectName.trim()) {
      toast({
        title: "Project name required",
        description: "Please enter a name for your project",
        variant: "destructive",
      });
      return;
    }
    
    onSelectTemplate(selectedTemplate);
    
    toast({
      title: "Project created",
      description: `Your ${selectedTemplate.name} project has been created`,
    });
    
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Start a New Project
          </DialogTitle>
          <DialogDescription>
            Choose a template to quickly get started with your project.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-hidden">
          <div className="md:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search templates..." 
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">CATEGORIES</Label>
              <RadioGroup 
                value={activeCategory} 
                onValueChange={setActiveCategory}
                className="space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Templates</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="frontend" id="frontend" />
                  <Label htmlFor="frontend">Frontend</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="backend" id="backend" />
                  <Label htmlFor="backend">Backend</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fullstack" id="fullstack" />
                  <Label htmlFor="fullstack">Full Stack</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <div className="md:col-span-2 overflow-hidden flex flex-col">
            {selectedTemplate ? (
              <div className="space-y-4 h-full flex flex-col">
                <Button 
                  variant="ghost" 
                  className="self-start" 
                  onClick={() => setSelectedTemplate(null)}
                >
                  ← Back to templates
                </Button>
                
                <div className="space-y-4 flex-1 overflow-auto">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedTemplate.name}</h2>
                    <p className="text-muted-foreground">{selectedTemplate.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge>{selectedTemplate.language}</Badge>
                      <Badge variant="outline">{selectedTemplate.category}</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input 
                      id="project-name" 
                      placeholder="my-awesome-project" 
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Files included</Label>
                    <div className="space-y-1">
                      {selectedTemplate.files.map((file, index) => (
                        <div key={index} className="flex items-center">
                          <File className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {selectedTemplate.dependencies.length > 0 && (
                    <div className="space-y-2">
                      <Label>Dependencies</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.dependencies.map((dep, index) => (
                          <Badge key={index} variant="outline">{dep}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="pt-4 border-t">
                  <Button onClick={handleCreateProject} className="w-full">
                    Create Project
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-4">
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No templates found matching your criteria</p>
                    </div>
                  ) : (
                    filteredTemplates.map(template => (
                      <Card 
                        key={template.id} 
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <CardDescription>{template.description}</CardDescription>
                        </CardHeader>
                        <CardFooter className="pt-1 border-t text-sm flex justify-between">
                          <Badge>{template.language}</Badge>
                          <Badge variant="outline">{template.category}</Badge>
                        </CardFooter>
                      </Card>
                    ))
                  )}
                </div>
                <ScrollBar />
              </ScrollArea>
            )}
          </div>
        </div>
        
        {!selectedTemplate && (
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}