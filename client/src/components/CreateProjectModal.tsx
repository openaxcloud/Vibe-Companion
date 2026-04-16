// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Sparkles, CheckCircle2, Github, Upload, Wand2, 
  Globe, Lock, FolderPlus, AlertCircle, FileCode, Package,
  Database, Rocket, RefreshCw, XCircle
} from "lucide-react";
import { ECodeLoading } from "@/components/ECodeLoading";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (name: string, projectId?: number) => void;
  isLoading?: boolean;
  initialDescription?: string;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  language?: string;
  category?: string;
  isFeatured?: boolean;
  icon?: string;
  starterFiles?: Record<string, string>;
}

interface CreationProgress {
  step: 'creating' | 'scaffolding' | 'installing' | 'configuring' | 'ready' | 'error';
  progress: number;
  message: string;
  details?: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name must be less than 50 characters"),
  description: z.string().optional(),
  template: z.string().default("blank"),
  visibility: z.enum(["public", "private"]).default("private"),
  aiPrompt: z.string().optional(),
  githubUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_TEMPLATES: Template[] = [
  { id: "blank", name: "Blank Repl", description: "Start from scratch", language: "javascript", icon: "📄" },
  { id: "python", name: "Python", description: "Python 3 environment", language: "python", icon: "🐍" },
  { id: "nodejs", name: "Node.js", description: "Node.js with npm", language: "javascript", icon: "🟢" },
  { id: "html", name: "HTML/CSS/JS", description: "Static web project", language: "html", icon: "🌐" },
  { id: "react", name: "React", description: "React with Vite", language: "typescript", icon: "⚛️" },
  { id: "typescript", name: "TypeScript", description: "TypeScript project", language: "typescript", icon: "📘" },
  { id: "flask", name: "Flask", description: "Python Flask API", language: "python", icon: "🌶️" },
  { id: "express", name: "Express.js", description: "Node.js Express API", language: "javascript", icon: "🚂" },
];

const CREATION_STEPS: Record<CreationProgress['step'], { label: string; icon: React.ReactNode; progress: number }> = {
  creating: { label: "Creating project...", icon: <FolderPlus className="h-5 w-5" />, progress: 20 },
  scaffolding: { label: "Scaffolding files...", icon: <FileCode className="h-5 w-5" />, progress: 40 },
  installing: { label: "Installing dependencies...", icon: <Package className="h-5 w-5" />, progress: 70 },
  configuring: { label: "Configuring environment...", icon: <Database className="h-5 w-5" />, progress: 90 },
  ready: { label: "Project ready!", icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, progress: 100 },
  error: { label: "Creation failed", icon: <AlertCircle className="h-5 w-5 text-red-500" />, progress: 0 },
};

const FALLBACK_STARTER_FILES: Record<string, Record<string, string>> = {
  blank: {
    'main.js': '// Welcome to your new project!\nconsole.log("Hello, World!");\n',
    'README.md': '# My Project\n\nA new project created with ECode.\n',
  },
  python: {
    'main.py': '# Welcome to your Python project!\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n',
    'requirements.txt': '# Add your dependencies here\n',
    'README.md': '# Python Project\n\nA new Python project.\n',
  },
  nodejs: {
    'index.js': 'const http = require("http");\n\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { "Content-Type": "text/plain" });\n  res.end("Hello, World!");\n});\n\nserver.listen(3000, () => {\n  console.log("Server running at http://localhost:3000/");\n});\n',
    'package.json': JSON.stringify({
      name: "my-nodejs-project",
      version: "1.0.0",
      main: "index.js",
      scripts: {
        start: "node index.js",
        dev: "node --watch index.js"
      }
    }, null, 2),
    'README.md': '# Node.js Project\n\nRun `npm start` to begin.\n',
  },
  html: {
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Website</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>Welcome to your new website.</p>\n  <script src="script.js"></script>\n</body>\n</html>\n',
    'style.css': 'body {\n  font-family: system-ui, sans-serif;\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 2rem;\n}\n\nh1 {\n  color: #333;\n}\n',
    'script.js': 'console.log("Page loaded!");\n',
  },
  react: {
    'src/App.tsx': 'import { useState } from "react";\nimport "./App.css";\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="app">\n      <h1>React + TypeScript</h1>\n      <button onClick={() => setCount(c => c + 1)}>\n        Count: {count}\n      </button>\n    </div>\n  );\n}\n\nexport default App;\n',
    'src/App.css': '.app {\n  text-align: center;\n  padding: 2rem;\n}\n\nbutton {\n  padding: 0.5rem 1rem;\n  font-size: 1rem;\n  cursor: pointer;\n}\n',
    'src/main.tsx': 'import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n',
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n',
    'package.json': JSON.stringify({
      name: "my-react-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.0.0",
        typescript: "^5.0.0",
        vite: "^5.0.0"
      }
    }, null, 2),
  },
  typescript: {
    'src/index.ts': '// Welcome to TypeScript!\n\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet("World"));\n',
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        outDir: "./dist"
      },
      include: ["src/**/*"]
    }, null, 2),
    'package.json': JSON.stringify({
      name: "my-typescript-project",
      version: "1.0.0",
      type: "module",
      scripts: {
        build: "tsc",
        start: "node dist/index.js",
        dev: "tsx watch src/index.ts"
      },
      devDependencies: {
        typescript: "^5.0.0",
        tsx: "^4.0.0"
      }
    }, null, 2),
  },
  flask: {
    'app.py': 'from flask import Flask\n\napp = Flask(__name__)\n\n@app.route("/")\ndef hello():\n    return "Hello, World!"\n\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port=5000, debug=True)\n',
    'requirements.txt': 'flask>=3.0.0\n',
    'README.md': '# Flask API\n\nRun `python app.py` to start the server.\n',
  },
  express: {
    'index.js': 'const express = require("express");\nconst app = express();\n\napp.use(express.json());\n\napp.get("/", (req, res) => {\n  res.json({ message: "Hello, World!" });\n});\n\napp.get("/api/health", (req, res) => {\n  res.json({ status: "ok" });\n});\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => {\n  console.log(`Server running on port ${PORT}`);\n});\n',
    'package.json': JSON.stringify({
      name: "my-express-api",
      version: "1.0.0",
      main: "index.js",
      scripts: {
        start: "node index.js",
        dev: "node --watch index.js"
      },
      dependencies: {
        express: "^4.18.0"
      }
    }, null, 2),
    'README.md': '# Express.js API\n\nRun `npm start` to launch the server.\n',
  },
};

export const CreateProjectModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading: externalLoading = false,
  initialDescription = ""
}: CreateProjectModalProps) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [creationTab, setCreationTab] = useState<'template' | 'ai' | 'github'>('template');
  const [creationProgress, setCreationProgress] = useState<CreationProgress | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);
  const [lastFormValues, setLastFormValues] = useState<FormValues | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: initialDescription,
      template: "blank",
      visibility: "private",
      aiPrompt: "",
      githubUrl: "",
    },
  });

  const { data: backendTemplates } = useQuery<{ templates: Template[] }>({
    queryKey: ['/api/templates', { limit: 20, featured: true }],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const templates = backendTemplates?.templates?.length 
    ? backendTemplates.templates.map(t => ({
        ...t,
        icon: t.icon || DEFAULT_TEMPLATES.find(dt => dt.id === t.language?.toLowerCase())?.icon || "📁"
      }))
    : DEFAULT_TEMPLATES;

  useEffect(() => {
    if (initialDescription) {
      let projectName = "";
      if (initialDescription.includes("web app") || initialDescription.includes("website")) {
        projectName = "My Website";
      } else if (initialDescription.includes("game")) {
        projectName = "Fun Game";
      } else if (initialDescription.includes("app")) {
        projectName = "My App";
      } else {
        const words = initialDescription.split(" ").slice(0, 4);
        projectName = words.join(" ");
        projectName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
      }
      form.setValue("name", projectName);
      form.setValue("description", initialDescription);
      form.setValue("aiPrompt", initialDescription);
      setCreationTab('ai');
    }
  }, [initialDescription, form]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const subscribeToCreationProgress = useCallback((projectId: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/projects/${projectId}/creation-progress`, {
        withCredentials: true
      });
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          const stepMap: Record<string, CreationProgress['step']> = {
            'created': 'creating',
            'scaffolded': 'scaffolding',
            'configured': 'configuring',
            'ready': 'ready',
            'complete': 'ready',
            'error': 'error',
          };

          const step = stepMap[data.step] || 'creating';
          
          setCreationProgress({
            step,
            progress: data.progress || CREATION_STEPS[step].progress,
            message: data.message || CREATION_STEPS[step].label,
            details: data.details
          });

          if (data.step === 'complete' || data.step === 'ready') {
            eventSource.close();
            eventSourceRef.current = null;
            resolve();
          } else if (data.step === 'error') {
            eventSource.close();
            eventSourceRef.current = null;
            reject(new Error(data.message || 'Project creation failed'));
          }
        } catch (err) {
          // Silent catch for SSE parsing issues
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        eventSourceRef.current = null;
        reject(new Error('Connection to progress stream lost'));
      };

      const timeout = setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close();
          eventSourceRef.current = null;
          reject(new Error('Project creation timed out. Please try again.'));
        }
      }, 60000);

      eventSource.addEventListener('close', () => {
        clearTimeout(timeout);
      });
    });
  }, []);

  const getTemplateStarterFiles = useCallback((templateId: string): Record<string, string> => {
    const backendTemplate = backendTemplates?.templates?.find(t => t.id === templateId);
    if (backendTemplate?.starterFiles && Object.keys(backendTemplate.starterFiles).length > 0) {
      return backendTemplate.starterFiles;
    }
    return FALLBACK_STARTER_FILES[templateId] || FALLBACK_STARTER_FILES.blank;
  }, [backendTemplates]);

  const scaffoldTemplateFiles = useCallback(async (projectId: number, template: string): Promise<void> => {
    const starterFiles = getTemplateStarterFiles(template);
    const errors: string[] = [];
    
    for (const [path, content] of Object.entries(starterFiles)) {
      try {
        await apiRequest('POST', `/api/projects/${projectId}/files`, {
          path,
          content,
          isDirectory: false,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${path}: ${errorMsg}`);
      }
    }
    
    if (errors.length > 0 && errors.length === Object.keys(starterFiles).length) {
      throw new Error(`Failed to scaffold all files: ${errors.join(', ')}`);
    }
  }, [getTemplateStarterFiles]);

  const importFromGitHub = useCallback(async (projectId: number, githubUrl: string): Promise<void> => {
    setCreationProgress({
      step: 'scaffolding',
      progress: 30,
      message: 'Cloning repository...'
    });

    try {
      const response = await apiRequest<{ success: boolean; message?: string }>('POST', `/api/git/clone`, {
        projectId: String(projectId),
        repoUrl: githubUrl,
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to clone repository');
      }
      
      setCreationProgress({
        step: 'configuring',
        progress: 80,
        message: 'Repository cloned successfully'
      });
    } catch (error) {
      const response = await apiRequest<{ success: boolean; message?: string }>('POST', `/api/projects/${projectId}/import-github`, {
        url: githubUrl,
      }).catch(() => null);
      
      if (!response?.success) {
        throw new Error(
          error instanceof Error 
            ? `GitHub import failed: ${error.message}` 
            : 'Failed to import from GitHub'
        );
      }
    }
  }, []);

  const createProjectMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setLastFormValues(values);
      
      const languageMap: Record<string, string> = {
        blank: 'javascript',
        python: 'python',
        nodejs: 'javascript',
        html: 'html',
        react: 'typescript',
        typescript: 'typescript',
        flask: 'python',
        express: 'javascript',
      };

      const response = await apiRequest<{ id: number; slug: string; name: string }>('POST', '/api/projects', {
        name: values.name,
        description: values.description || values.aiPrompt,
        language: languageMap[values.template] || 'javascript',
        visibility: values.visibility,
        template: values.template,
        aiPrompt: values.aiPrompt,
        githubUrl: values.githubUrl,
      });
      
      return response;
    },
    onSuccess: async (project, values) => {
      setCreatedProjectId(project.id);
      setCreationProgress({ step: 'creating', progress: 50, message: 'Project created!' });
      
      // Invalidate projects cache immediately
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      // Navigate to IDE immediately - scaffolding happens in background
      setCreationProgress({ step: 'ready', progress: 100, message: 'Opening workspace...' });
      
      // Store AI prompt in sessionStorage so the IDE agent panel auto-sends it
      if (values.aiPrompt) {
        sessionStorage.setItem(`agent-prompt-${project.id}`, values.aiPrompt);
      }

      // Short delay for visual feedback, then navigate
      setTimeout(() => {
        onSubmit?.(project.name, project.id);
        navigate(`/ide/${project.id}`);
        onClose();
        resetState();
      }, 300);
      
      // Scaffold files in background (non-blocking)
      if (creationTab === 'github' && values.githubUrl) {
        importFromGitHub(project.id, values.githubUrl).catch(() => {});
      } else {
        scaffoldTemplateFiles(project.id, values.template).catch(() => {});
      }
    },
    onError: (error: Error) => {
      setCreationProgress({ 
        step: 'error', 
        progress: 0, 
        message: 'Failed to create project',
        details: error.message
      });
      toast({
        title: "Error creating project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateWithAI = async () => {
    const prompt = form.getValues('aiPrompt');
    if (!prompt?.trim()) {
      toast({
        title: "Please describe your app",
        description: "Enter a description for AI to generate your project structure.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await apiRequest<{
        success: boolean;
        projectId?: number;
        sessionId?: string;
        bootstrapToken?: string;
        project?: { id: number; name: string; slug: string };
        error?: string;
      }>('POST', '/api/workspace/bootstrap', {
        prompt,
        buildMode: 'full-app',
        options: {
          language: 'typescript',
          framework: 'react',
          autoStart: true,
          visibility: form.getValues('visibility'),
          designFirst: false
        }
      });

      if (response.success && response.projectId) {
        toast({
          title: "AI project created",
          description: "Redirecting to your new project...",
        });
        
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        
        const projectName = response.projectSlug || `Project ${response.projectId}`;
        onSubmit?.(projectName, response.projectId);
        
        const redirectUrl = response.bootstrapToken 
          ? `/ide/${response.projectId}?bootstrap=${response.bootstrapToken}`
          : `/ide/${response.projectId}`;
        navigate(redirectUrl);
        onClose();
        resetState();
        return;
      }
      
      const words = prompt.split(' ').slice(0, 4);
      let suggestedName = words.join(' ');
      suggestedName = suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1);
      form.setValue('name', suggestedName);
      
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes('react') || lowerPrompt.includes('frontend')) {
        form.setValue('template', 'react');
      } else if (lowerPrompt.includes('python') || lowerPrompt.includes('flask') || lowerPrompt.includes('ml') || lowerPrompt.includes('machine learning')) {
        form.setValue('template', 'python');
      } else if (lowerPrompt.includes('api') || lowerPrompt.includes('backend') || lowerPrompt.includes('express')) {
        form.setValue('template', 'express');
      } else if (lowerPrompt.includes('website') || lowerPrompt.includes('landing')) {
        form.setValue('template', 'html');
      } else if (lowerPrompt.includes('typescript')) {
        form.setValue('template', 'typescript');
      }
      
      form.setValue('description', prompt);
      
      toast({
        title: "AI suggestion applied",
        description: "Project structure suggested based on your description. Click Create to proceed.",
      });
    } catch (error) {
      const words = prompt.split(' ').slice(0, 4);
      let suggestedName = words.join(' ');
      suggestedName = suggestedName.charAt(0).toUpperCase() + suggestedName.slice(1);
      form.setValue('name', suggestedName);
      form.setValue('description', prompt);
      
      toast({
        title: "AI generation unavailable",
        description: "Using template-based setup. You can still create your project.",
        variant: "default",
      });
    } finally {
      setIsGeneratingAI(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetry = useCallback(() => {
    if (lastFormValues) {
      setCreationProgress({ step: 'creating', progress: 10, message: 'Retrying...' });
      createProjectMutation.mutate(lastFormValues);
    } else {
      setCreationProgress(null);
    }
  }, [lastFormValues, createProjectMutation]);

  const handleCancelCreation = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setCreationProgress(null);
    setCreatedProjectId(null);
    setLastFormValues(null);
  }, []);

  const resetState = useCallback(() => {
    setCreationProgress(null);
    setCreatedProjectId(null);
    setLastFormValues(null);
    setIsGeneratingAI(false);
    form.reset();
  }, [form]);

  const handleSubmit = async (values: FormValues) => {
    setCreationProgress({ step: 'creating', progress: 10, message: 'Creating your project...' });
    createProjectMutation.mutate(values);
  };

  const handleClose = () => {
    if (!creationProgress && !createProjectMutation.isPending) {
      onClose();
      resetState();
    }
  };

  const isSubmitting = createProjectMutation.isPending || (!!creationProgress && creationProgress.step !== 'error');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[560px] bg-[var(--ecode-surface)] border-[var(--ecode-border)] max-h-[90vh] overflow-y-auto">
        {creationProgress ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="relative">
              {creationProgress.step === 'ready' ? (
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in duration-300">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              ) : creationProgress.step === 'error' ? (
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center animate-in zoom-in duration-200">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
              ) : (
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-2 border-[var(--ecode-accent)]/20 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-[var(--ecode-accent)] animate-spin" />
                  </div>
                  <div className="absolute -top-1 -right-1 bg-[var(--ecode-surface)] rounded-full p-0.5">
                    {CREATION_STEPS[creationProgress.step].icon}
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center space-y-2 w-full max-w-sm">
              <h3 className="text-[15px] font-semibold text-[var(--ecode-text)]">
                {CREATION_STEPS[creationProgress.step].label}
              </h3>
              <p className="text-[13px] text-[var(--ecode-text-secondary)]">
                {creationProgress.message}
              </p>
              {creationProgress.details && (
                <p className="text-[11px] text-red-400 mt-2 break-words">{creationProgress.details}</p>
              )}
              
              {creationProgress.step !== 'error' && creationProgress.step !== 'ready' && (
                <div className="pt-4 space-y-3">
                  <Progress value={creationProgress.progress} className="h-1.5" />
                  <div className="flex items-center justify-center gap-4">
                    {(Object.keys(CREATION_STEPS) as CreationProgress['step'][]).filter(s => s !== 'error').map((step, idx) => {
                      const stepConfig = CREATION_STEPS[step];
                      const currentIdx = (Object.keys(CREATION_STEPS) as CreationProgress['step'][]).filter(s => s !== 'error').indexOf(creationProgress.step);
                      const isActive = step === creationProgress.step;
                      const isDone = idx < currentIdx;
                      return (
                        <div key={step} className="flex items-center gap-1">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full transition-all duration-300",
                            isActive ? "bg-[var(--ecode-accent)] scale-125" :
                            isDone ? "bg-green-500" : "bg-[var(--ecode-border)]"
                          )} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            {creationProgress.step === 'error' && (
              <div className="flex gap-3 mt-4">
                <Button 
                  variant="outline" 
                  onClick={handleCancelCreation}
                  className="border-[var(--ecode-border)]"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleRetry}
                  className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)]"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle className="text-2xl text-[var(--ecode-text)] flex items-center gap-2">
                <Rocket className="h-6 w-6 text-[var(--ecode-accent)]" />
                Create a Repl
              </DialogTitle>
              <DialogDescription className="text-[var(--ecode-muted)]">
                Start coding in seconds with an interactive programming environment
              </DialogDescription>
            </DialogHeader>

            <Tabs value={creationTab} onValueChange={(v) => setCreationTab(v as typeof creationTab)} className="mt-4">
              <TabsList className="grid w-full grid-cols-3 bg-[var(--ecode-sidebar)]">
                <TabsTrigger value="template" className="flex items-center gap-1.5">
                  <FolderPlus className="h-4 w-4" />
                  Template
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" />
                  AI Generate
                </TabsTrigger>
                <TabsTrigger value="github" className="flex items-center gap-1.5">
                  <Github className="h-4 w-4" />
                  Import
                </TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[var(--ecode-text)]">Title</Label>
                  <Input
                    id="name"
                    placeholder="My Repl"
                    {...form.register("name")}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                    data-testid="input-project-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-[13px] text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[var(--ecode-text)]">Template</Label>
                  <Controller
                    name="template"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]">
                          <SelectValue placeholder="Choose a template" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
                          {templates.map((template) => (
                            <SelectItem 
                              key={template.id} 
                              value={template.id}
                              className="text-[var(--ecode-text)]"
                            >
                              <span className="flex items-center gap-2">
                                <span>{template.icon}</span>
                                <span>{template.name}</span>
                                {template.isFeatured && (
                                  <span className="text-[11px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">Featured</span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[var(--ecode-text)]">
                    Description (optional)
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="What will your Repl do?"
                    {...form.register("description")}
                    className="min-h-[60px] resize-none bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="ai" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="aiPrompt" className="text-[var(--ecode-text)] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Describe your app
                  </Label>
                  <Textarea
                    id="aiPrompt"
                    placeholder="e.g., A todo app with dark mode and local storage, or a Python script that scrapes news headlines..."
                    {...form.register("aiPrompt")}
                    className="min-h-[100px] resize-none bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateWithAI}
                    disabled={isGeneratingAI}
                    className="w-full border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  >
                    {isGeneratingAI ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Project Structure
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name-ai" className="text-[var(--ecode-text)]">Project Name</Label>
                  <Input
                    id="name-ai"
                    placeholder="Generated from your description"
                    {...form.register("name")}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="github" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="githubUrl" className="text-[var(--ecode-text)] flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub Repository URL
                  </Label>
                  <Input
                    id="githubUrl"
                    placeholder="https://github.com/username/repo"
                    {...form.register("githubUrl")}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  />
                  <p className="text-[11px] text-[var(--ecode-muted)]">
                    Import an existing repository to continue working on it
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name-github" className="text-[var(--ecode-text)]">Project Name</Label>
                  <Input
                    id="name-github"
                    placeholder="my-imported-repo"
                    {...form.register("name")}
                    className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <Upload className="h-4 w-4 text-yellow-500" />
                  <span className="text-[13px] text-yellow-600 dark:text-yellow-400">
                    GitHub import will clone the repository files
                  </span>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-4 border-t border-[var(--ecode-border)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Controller
                    name="visibility"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Switch
                          id="visibility"
                          checked={field.value === 'public'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'public' : 'private')}
                        />
                        <Label htmlFor="visibility" className="text-[13px] text-[var(--ecode-text)] flex items-center gap-1.5 cursor-pointer">
                          {field.value === 'public' ? (
                            <>
                              <Globe className="h-4 w-4 text-green-500" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4 text-[var(--ecode-muted)]" />
                              Private
                            </>
                          )}
                        </Label>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          
            <DialogFooter className="mt-6">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                type="button"
                disabled={isSubmitting}
                className="border-[var(--ecode-border)] text-[var(--ecode-text)]"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || externalLoading}
                className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
                data-testid="button-create-project"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    Create Repl
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
