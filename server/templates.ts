interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  files: Record<string, string>;
}

const templates: Template[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Start from scratch",
    language: "javascript",
    category: "general",
    files: { "index.js": '// Start coding here\nconsole.log("Hello, World!");\n' },
  },
  {
    id: "react",
    name: "React App",
    description: "React with Vite",
    language: "typescript",
    category: "frontend",
    files: { "src/App.tsx": 'export default function App() {\n  return <div>Hello React</div>;\n}\n' },
  },
  {
    id: "express",
    name: "Express API",
    description: "Express.js REST API",
    language: "typescript",
    category: "backend",
    files: { "server.ts": 'import express from "express";\nconst app = express();\napp.get("/", (req, res) => res.json({ hello: "world" }));\napp.listen(3000);\n' },
  },
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function getAllTemplates(): Template[] {
  return templates;
}
