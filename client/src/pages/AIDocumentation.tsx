// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Bot, BookOpen, Code, Sparkles, Zap, ChevronRight, Search, 
  ExternalLink, ArrowRight, FileText, Terminal, Rocket, Brain, 
  ChevronDown, Play, Copy, Check, AlertCircle, Star, MessageSquare, 
  Lightbulb, Settings, History, RefreshCw, Download, HelpCircle, 
  Send, Wand2, BookTemplate, Cpu, Globe, Shield, BarChart, 
  Code2, Braces, Hash, FileJson, Command, Package, Database,
  GitBranch, Users, GraduationCap, Trophy, Heart, CheckCircle,
  XCircle, Info, TrendingUp, Clock, DollarSign, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Composant pour le testeur de prompts interactif
function PromptTester() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-4.1');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [variables, setVariables] = useState({
    projectName: 'MyProject',
    language: 'TypeScript',
    framework: 'React'
  });
  const { toast } = useToast();

  const handleTestPrompt = async () => {
    if (!prompt) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un prompt à tester",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    // Simuler une réponse AI
    setTimeout(() => {
      let processedPrompt = prompt;
      Object.entries(variables).forEach(([key, value]) => {
        processedPrompt = processedPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
      
      setResponse(`// Réponse générée par ${model}\n// Prompt traité: ${processedPrompt}\n\nfunction exampleComponent() {\n  // Code généré basé sur votre prompt\n  return (\n    <div className="example">\n      <h1>${variables.projectName}</h1>\n      <p>Implémenté en ${variables.language}</p>\n    </div>\n  );\n}`);
      setIsLoading(false);
      toast({
        title: "Test réussi",
        description: "Le prompt a été testé avec succès",
      });
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5" />
          Testeur de Prompts Interactif
        </CardTitle>
        <CardDescription>
          Testez vos prompts en temps réel avec différents modèles et variables
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Variables du prompt</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="{{projectName}}"
              value={variables.projectName}
              onChange={(e) => setVariables({...variables, projectName: e.target.value})}
            />
            <Input
              placeholder="{{language}}"
              value={variables.language}
              onChange={(e) => setVariables({...variables, language: e.target.value})}
            />
            <Input
              placeholder="{{framework}}"
              value={variables.framework}
              onChange={(e) => setVariables({...variables, framework: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modèle AI</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
              <SelectItem value="gpt-4.1-mini">GPT-4.1 Mini</SelectItem>
              <SelectItem value="o4-mini">o4-mini</SelectItem>
              <SelectItem value="o3">o3</SelectItem>
              <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4</SelectItem>
              <SelectItem value="claude-opus-4-7">Claude Opus 4</SelectItem>
              <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Votre prompt</Label>
          <Textarea
            placeholder="Entrez votre prompt avec des variables comme {{projectName}}, {{language}}, etc."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <Button 
          onClick={handleTestPrompt} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Test en cours...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Tester le prompt
            </>
          )}
        </Button>

        {response && (
          <div className="mt-4">
            <Label>Résultat</Label>
            <div className="relative">
              <SyntaxHighlighter
                language="javascript"
                style={tomorrow}
                className="rounded-lg"
              >
                {response}
              </SyntaxHighlighter>
              <Button
                size="icon"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => {
                  navigator.clipboard.writeText(response);
                  toast({
                    title: "Copié",
                    description: "Le code a été copié dans le presse-papiers",
                  });
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Composant pour la comparaison de modèles
function ModelComparison() {
  const [prompt, setPrompt] = useState('Crée une fonction pour calculer la factorielle d\'un nombre');
  const [results, setResults] = useState<any[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const models = [
    { id: 'gpt-4.1', name: 'GPT-4.1', speed: 95, accuracy: 98, cost: 3 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4', speed: 90, accuracy: 97, cost: 2.5 },
    { id: 'claude-opus-4-7', name: 'Claude Opus 4', speed: 88, accuracy: 99, cost: 5 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', speed: 92, accuracy: 95, cost: 2 },
    { id: 'o3', name: 'o3', speed: 80, accuracy: 99, cost: 4 }
  ];

  const handleCompare = () => {
    setIsComparing(true);
    // Simuler les réponses
    setTimeout(() => {
      setResults(models.map(model => ({
        ...model,
        response: `// Réponse de ${model.name}\nfunction factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n - 1);\n}`,
        time: Math.random() * 2 + 0.5,
        tokens: Math.floor(Math.random() * 100 + 50)
      })));
      setIsComparing(false);
    }, 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Comparaison des Modèles AI
        </CardTitle>
        <CardDescription>
          Comparez les réponses et performances de différents modèles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label>Prompt de test</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="mt-2"
            />
          </div>

          <Button 
            onClick={handleCompare}
            disabled={isComparing}
            className="w-full"
          >
            {isComparing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Comparaison en cours...
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 mr-2" />
                Lancer la comparaison
              </>
            )}
          </Button>

          {results.length > 0 && (
            <div className="grid gap-4 mt-6">
              {results.map((result) => (
                <Card key={result.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{result.name}</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {result.time.toFixed(2)}s
                        </Badge>
                        <Badge variant="outline">
                          <Hash className="h-3 w-3 mr-1" />
                          {result.tokens} tokens
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Vitesse</div>
                        <Progress value={result.speed} className="mt-1" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Précision</div>
                        <Progress value={result.accuracy} className="mt-1" />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Coût</div>
                        <Progress value={result.cost * 33} className="mt-1" />
                      </div>
                    </div>
                    <SyntaxHighlighter
                      language="javascript"
                      style={tomorrow}
                      className="text-sm"
                    >
                      {result.response}
                    </SyntaxHighlighter>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Composant principal de documentation
export default function AIDocumentation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<string[]>(['overview']);
  const { toast } = useToast();
  const sectionsRef = useRef<{ [key: string]: HTMLElement | null }>({});

  // Sections de la documentation
  const sections = [
    {
      id: 'overview',
      title: '🚀 Vue d\'ensemble',
      icon: <Rocket className="h-5 w-5" />,
      content: 'overview'
    },
    {
      id: 'capabilities',
      title: '🤖 Capacités AI',
      icon: <Bot className="h-5 w-5" />,
      content: 'capabilities'
    },
    {
      id: 'prompts',
      title: '✏️ Guide des Prompts',
      icon: <FileText className="h-5 w-5" />,
      content: 'prompts'
    },
    {
      id: 'templates',
      title: '📚 Templates',
      icon: <BookTemplate className="h-5 w-5" />,
      content: 'templates'
    },
    {
      id: 'usecases',
      title: '💡 Cas d\'usage',
      icon: <Lightbulb className="h-5 w-5" />,
      content: 'usecases'
    },
    {
      id: 'api',
      title: '🔧 API Reference',
      icon: <Code className="h-5 w-5" />,
      content: 'api'
    },
    {
      id: 'faq',
      title: '❓ FAQ & Support',
      icon: <HelpCircle className="h-5 w-5" />,
      content: 'faq'
    },
    {
      id: 'tutorials',
      title: '🎓 Tutoriels',
      icon: <GraduationCap className="h-5 w-5" />,
      content: 'tutorials'
    }
  ];

  // Scroll spy pour la navigation
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      
      for (const section of sections) {
        const element = sectionsRef.current[section.id];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = sectionsRef.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const renderSectionContent = (contentId: string) => {
    switch (contentId) {
      case 'overview':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Bienvenue dans la Documentation AI d'E-Code</h2>
            <p className="lead">
              E-Code intègre les modèles d'intelligence artificielle les plus avancés pour vous aider 
              à coder plus rapidement et plus efficacement que jamais.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Modèles de pointe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      GPT-4.1 / GPT-4.1 Mini / GPT-4.1 Nano
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      o4-mini / o3
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Claude Sonnet 4 / Claude Opus 4
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Gemini 2.5 Pro / Gemini 2.5 Flash
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Fonctionnalités clés
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Génération de code automatique
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Analyse contextuelle du projet
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Debugging intelligent
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Refactoring assisté
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Alert className="mt-6">
              <Zap className="h-4 w-4" />
              <AlertTitle>Démarrage rapide</AlertTitle>
              <AlertDescription>
                Appuyez sur <kbd className="px-2 py-1 text-xs bg-muted rounded">Ctrl+K</kbd> pour 
                ouvrir l'assistant AI et commencer à générer du code immédiatement.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'capabilities':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Capacités AI Avancées</h2>
            
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Agent Autonome de Génération de Code</CardTitle>
                  <CardDescription>
                    L'agent AI peut créer des applications complètes à partir de descriptions en langage naturel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Capacités principales:</h4>
                      <ul className="space-y-2">
                        <li>• Génération d'applications full-stack complètes</li>
                        <li>• Création automatique de bases de données et schémas</li>
                        <li>• Implémentation de logique métier complexe</li>
                        <li>• Configuration automatique des dépendances</li>
                        <li>• Tests unitaires et d'intégration</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Langages et frameworks supportés:</h4>
                      <div className="flex flex-wrap gap-2">
                        <Badge>React</Badge>
                        <Badge>Vue.js</Badge>
                        <Badge>Angular</Badge>
                        <Badge>Node.js</Badge>
                        <Badge>Python</Badge>
                        <Badge>Java</Badge>
                        <Badge>Go</Badge>
                        <Badge>Rust</Badge>
                        <Badge>TypeScript</Badge>
                        <Badge>C++</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Analyse Contextuelle Intelligente</CardTitle>
                  <CardDescription>
                    L'AI comprend le contexte complet de votre projet pour des suggestions pertinentes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2">Analyse du code:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Structure du projet</li>
                        <li>• Dépendances utilisées</li>
                        <li>• Patterns de code</li>
                        <li>• Conventions de nommage</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Optimisations suggérées:</h4>
                      <ul className="text-sm space-y-1">
                        <li>• Performance</li>
                        <li>• Sécurité</li>
                        <li>• Maintenabilité</li>
                        <li>• Best practices</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Raffinement Automatique des Prompts</CardTitle>
                  <CardDescription>
                    Le système améliore automatiquement vos prompts pour de meilleurs résultats
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-semibold mb-1">Prompt original:</p>
                      <p className="text-sm">"Crée un formulaire de contact"</p>
                    </div>
                    <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <p className="text-sm font-semibold mb-1">Prompt raffiné:</p>
                      <p className="text-sm">
                        "Crée un formulaire de contact React avec validation TypeScript, 
                        incluant les champs nom, email, message, avec gestion des erreurs 
                        et feedback utilisateur, utilisant react-hook-form et zod"
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'prompts':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Guide Complet des Custom Prompts</h2>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Créer des Prompts Efficaces</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Structure recommandée:</h4>
                    <ol className="list-decimal list-inside space-y-2">
                      <li><strong>Contexte:</strong> Décrivez le projet et son objectif</li>
                      <li><strong>Tâche:</strong> Spécifiez ce que vous voulez créer</li>
                      <li><strong>Contraintes:</strong> Mentionnez les technologies, frameworks</li>
                      <li><strong>Détails:</strong> Ajoutez des spécifications précises</li>
                      <li><strong>Format:</strong> Indiquez le format de sortie souhaité</li>
                    </ol>
                  </div>

                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertTitle>Astuce Pro</AlertTitle>
                    <AlertDescription>
                      Utilisez des variables comme <code>{'{{projectName}}'}</code> pour 
                      créer des prompts réutilisables.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Variables Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{projectName}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Nom du projet actuel</p>
                    </div>
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{language}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Langage principal</p>
                    </div>
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{framework}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Framework utilisé</p>
                    </div>
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{fileName}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Fichier actuel</p>
                    </div>
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{selectedCode}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Code sélectionné</p>
                    </div>
                    <div>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{'{{dependencies}}'}</code>
                      <p className="text-sm text-muted-foreground mt-1">Dépendances installées</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exemples de Prompts</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="component">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="component">Composant</TabsTrigger>
                    <TabsTrigger value="api">API</TabsTrigger>
                    <TabsTrigger value="database">Database</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="component" className="mt-4">
                    <SyntaxHighlighter language="text" style={tomorrow}>
{`Create a React component named {{componentName}} that:
- Uses TypeScript for type safety
- Implements {{feature}} functionality
- Follows {{projectName}} design system
- Includes comprehensive error handling
- Has unit tests with Jest and React Testing Library
- Uses {{framework}} best practices
- Includes JSDoc documentation`}
                    </SyntaxHighlighter>
                  </TabsContent>
                  
                  <TabsContent value="api" className="mt-4">
                    <SyntaxHighlighter language="text" style={tomorrow}>
{`Generate a REST API endpoint for {{resource}}:
- Method: {{method}}
- Route: /api/{{route}}
- Authentication: JWT Bearer token
- Request validation using Zod
- Error handling with proper HTTP status codes
- Database: {{database}}
- Include Swagger documentation`}
                    </SyntaxHighlighter>
                  </TabsContent>
                  
                  <TabsContent value="database" className="mt-4">
                    <SyntaxHighlighter language="text" style={tomorrow}>
{`Create a database schema for {{entity}}:
- Database: PostgreSQL
- ORM: Prisma/TypeORM
- Fields: {{fields}}
- Relationships: {{relationships}}
- Indexes for performance
- Migration file
- Seed data for development`}
                    </SyntaxHighlighter>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        );

      case 'templates':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Bibliothèque de Templates de Prompts</h2>
            
            <div className="grid gap-4">
              {[
                {
                  title: 'Application React Complète',
                  category: 'Full-Stack',
                  description: 'Génère une application React avec routing, state management et API',
                  prompt: 'Create a complete React application with TypeScript, React Router, Redux Toolkit, and Material-UI. Include user authentication, dashboard, and CRUD operations for {{resource}}.',
                  tags: ['React', 'TypeScript', 'Redux', 'Full-Stack']
                },
                {
                  title: 'API REST Node.js',
                  category: 'Backend',
                  description: 'Crée une API REST complète avec authentification et validation',
                  prompt: 'Build a Node.js REST API with Express, TypeScript, JWT authentication, input validation with Joi, and MongoDB integration. Include CRUD endpoints for {{resource}} with proper error handling.',
                  tags: ['Node.js', 'Express', 'MongoDB', 'JWT']
                },
                {
                  title: 'Landing Page Moderne',
                  category: 'Frontend',
                  description: 'Génère une landing page responsive avec animations',
                  prompt: 'Create a modern landing page with hero section, features grid, testimonials, pricing cards, and contact form. Use Tailwind CSS, Framer Motion for animations, and ensure full responsiveness.',
                  tags: ['HTML', 'CSS', 'Tailwind', 'Animations']
                },
                {
                  title: 'Dashboard Analytics',
                  category: 'Frontend',
                  description: 'Crée un dashboard avec graphiques et métriques',
                  prompt: 'Build an analytics dashboard with charts (line, bar, pie), KPI cards, data tables with sorting/filtering, and export functionality. Use React, Recharts, and Tailwind CSS.',
                  tags: ['React', 'Charts', 'Dashboard', 'Analytics']
                },
                {
                  title: 'Tests Automatisés',
                  category: 'Testing',
                  description: 'Génère des tests unitaires et d\'intégration',
                  prompt: 'Write comprehensive tests for {{componentName}} including unit tests with Jest, integration tests, mocking external dependencies, and achieving >80% code coverage.',
                  tags: ['Jest', 'Testing', 'TDD', 'Mocking']
                },
                {
                  title: 'Configuration CI/CD',
                  category: 'DevOps',
                  description: 'Met en place un pipeline CI/CD complet',
                  prompt: 'Create a CI/CD pipeline configuration for GitHub Actions including build, test, lint, security scanning, and deployment to {{platform}}. Include environment variables and secrets management.',
                  tags: ['CI/CD', 'GitHub Actions', 'DevOps', 'Deployment']
                }
              ].map((template, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.title}</CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </div>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="relative">
                        <SyntaxHighlighter 
                          language="text" 
                          style={tomorrow}
                          className="text-sm"
                        >
                          {template.prompt}
                        </SyntaxHighlighter>
                        <Button
                          size="icon"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            navigator.clipboard.writeText(template.prompt);
                            toast({
                              title: "Template copié",
                              description: "Le template a été copié dans le presse-papiers",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'usecases':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Cas d'Usage Pratiques</h2>
            
            <div className="space-y-6">
              {[
                {
                  title: 'Génération d\'une Application React Complète',
                  icon: <Code2 className="h-5 w-5" />,
                  steps: [
                    'Ouvrez l\'assistant AI avec Ctrl+K',
                    'Entrez: "Créer une application e-commerce avec React, TypeScript, panier, paiement Stripe"',
                    'L\'AI génère la structure complète du projet',
                    'Examinez le code généré et demandez des ajustements si nécessaire',
                    'Déployez l\'application en un clic'
                  ],
                  result: 'Application e-commerce fonctionnelle avec gestion du panier et paiement intégré'
                },
                {
                  title: 'Création d\'API REST avec Node.js',
                  icon: <Terminal className="h-5 w-5" />,
                  steps: [
                    'Sélectionnez le template "API REST Node.js"',
                    'Personnalisez les entités et relations',
                    'L\'AI génère les endpoints CRUD complets',
                    'Ajoute automatiquement la validation et l\'authentification',
                    'Génère la documentation Swagger'
                  ],
                  result: 'API REST complète avec auth JWT, validation et documentation'
                },
                {
                  title: 'Configuration de Base de Données',
                  icon: <Database className="h-5 w-5" />,
                  steps: [
                    'Décrivez votre modèle de données en langage naturel',
                    'L\'AI génère le schéma Prisma/TypeORM',
                    'Création automatique des migrations',
                    'Génération des seeds pour les tests',
                    'Configuration des indexes pour la performance'
                  ],
                  result: 'Base de données configurée avec ORM, migrations et données de test'
                },
                {
                  title: 'Implémentation de Tests Automatisés',
                  icon: <Shield className="h-5 w-5" />,
                  steps: [
                    'Sélectionnez le code à tester',
                    'Demandez: "Écrire des tests complets pour ce composant"',
                    'L\'AI génère tests unitaires et d\'intégration',
                    'Ajoute les mocks nécessaires',
                    'Configure le coverage report'
                  ],
                  result: 'Suite de tests complète avec >80% de couverture'
                },
                {
                  title: 'Optimisation de Performances',
                  icon: <Zap className="h-5 w-5" />,
                  steps: [
                    'L\'AI analyse le code pour identifier les bottlenecks',
                    'Suggère des optimisations spécifiques',
                    'Implémente lazy loading et code splitting',
                    'Optimise les requêtes base de données',
                    'Ajoute la mise en cache appropriée'
                  ],
                  result: 'Application optimisée avec temps de chargement réduit de 60%'
                },
                {
                  title: 'Debugging Assisté par AI',
                  icon: <AlertCircle className="h-5 w-5" />,
                  steps: [
                    'Copiez le message d\'erreur dans l\'assistant',
                    'L\'AI analyse le contexte et la stack trace',
                    'Identifie la cause racine du problème',
                    'Propose plusieurs solutions avec explications',
                    'Implémente la correction choisie'
                  ],
                  result: 'Erreur résolue avec explication détaillée de la solution'
                }
              ].map((useCase, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {useCase.icon}
                      {useCase.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Étapes:</h4>
                        <ol className="list-decimal list-inside space-y-1">
                          {useCase.steps.map((step, idx) => (
                            <li key={idx} className="text-sm">{step}</li>
                          ))}
                        </ol>
                      </div>
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Résultat</AlertTitle>
                        <AlertDescription>{useCase.result}</AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 'api':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>API Reference</h2>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Endpoints Disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      method: 'POST',
                      endpoint: '/api/ai/generate',
                      description: 'Génère du code basé sur un prompt',
                      body: {
                        prompt: 'string',
                        model: 'gpt-5 | claude-3.5 | gemini-pro',
                        temperature: 'number (0-1)',
                        maxTokens: 'number',
                        projectContext: 'object'
                      }
                    },
                    {
                      method: 'POST',
                      endpoint: '/api/ai/complete',
                      description: 'Auto-complétion de code',
                      body: {
                        code: 'string',
                        cursor: 'number',
                        language: 'string',
                        fileName: 'string'
                      }
                    },
                    {
                      method: 'POST',
                      endpoint: '/api/ai/refactor',
                      description: 'Refactoring de code existant',
                      body: {
                        code: 'string',
                        instructions: 'string',
                        preserveLogic: 'boolean'
                      }
                    },
                    {
                      method: 'POST',
                      endpoint: '/api/ai/explain',
                      description: 'Explication de code',
                      body: {
                        code: 'string',
                        level: 'beginner | intermediate | expert'
                      }
                    },
                    {
                      method: 'GET',
                      endpoint: '/api/ai/models',
                      description: 'Liste des modèles disponibles',
                      body: null
                    },
                    {
                      method: 'GET',
                      endpoint: '/api/ai/usage',
                      description: 'Statistiques d\'utilisation',
                      body: null
                    }
                  ].map((api, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={api.method === 'GET' ? 'secondary' : 'default'}>
                          {api.method}
                        </Badge>
                        <code className="text-sm font-mono">{api.endpoint}</code>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{api.description}</p>
                      {api.body && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Request Body:</p>
                          <SyntaxHighlighter 
                            language="json" 
                            style={tomorrow}
                            className="text-sm"
                          >
                            {JSON.stringify(api.body, null, 2)}
                          </SyntaxHighlighter>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Limites et Quotas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold">Plan Gratuit</h4>
                      <ul className="text-sm space-y-1 mt-2">
                        <li>• 100 requêtes/jour</li>
                        <li>• 10,000 tokens/requête max</li>
                        <li>• Modèles de base uniquement</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold">Plan Pro</h4>
                      <ul className="text-sm space-y-1 mt-2">
                        <li>• Requêtes illimitées</li>
                        <li>• 100,000 tokens/requête max</li>
                        <li>• Tous les modèles disponibles</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Gestion des Erreurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { code: 400, message: 'Bad Request', description: 'Paramètres invalides ou manquants' },
                    { code: 401, message: 'Unauthorized', description: 'Token API manquant ou invalide' },
                    { code: 429, message: 'Rate Limited', description: 'Limite de requêtes atteinte' },
                    { code: 500, message: 'Server Error', description: 'Erreur interne du serveur' },
                    { code: 503, message: 'Service Unavailable', description: 'Service temporairement indisponible' }
                  ].map(error => (
                    <div key={error.code} className="flex items-start gap-3 p-3 border rounded-lg">
                      <Badge variant="destructive">{error.code}</Badge>
                      <div>
                        <p className="font-semibold text-sm">{error.message}</p>
                        <p className="text-sm text-muted-foreground">{error.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'faq':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Questions Fréquemment Posées</h2>
            
            <div className="space-y-4">
              {[
                {
                  question: 'Quelle est la différence entre GPT-4.1 et Claude Sonnet 4?',
                  answer: 'GPT-4.1 excelle dans la génération de code créatif et la compréhension de contextes complexes, tandis que Claude Sonnet 4 est particulièrement efficace pour le raisonnement logique et l\'analyse de code. Nous recommandons de tester les deux pour votre cas d\'usage spécifique.',
                  category: 'Modèles'
                },
                {
                  question: 'Comment optimiser mes prompts pour de meilleurs résultats?',
                  answer: 'Soyez spécifique et détaillé. Incluez le contexte, les technologies souhaitées, et des exemples si possible. Utilisez les variables de template pour la réutilisabilité. Notre système de raffinement automatique améliorera également vos prompts.',
                  category: 'Prompts'
                },
                {
                  question: 'Les données de mon projet sont-elles sécurisées?',
                  answer: 'Absolument. Nous utilisons un chiffrement de bout en bout, ne stockons jamais votre code sur nos serveurs AI, et respectons strictement le RGPD. Vos projets restent privés et sécurisés.',
                  category: 'Sécurité'
                },
                {
                  question: 'Puis-je utiliser l\'AI hors ligne?',
                  answer: 'Non, l\'accès aux modèles AI nécessite une connexion internet. Cependant, nous mettons en cache intelligemment les réponses fréquentes pour améliorer les performances.',
                  category: 'Technique'
                },
                {
                  question: 'Comment sont calculés les tokens utilisés?',
                  answer: 'Les tokens incluent votre prompt et la réponse générée. En moyenne, 1 token ≈ 4 caractères. Un prompt typique utilise 100-500 tokens, et une réponse complète 500-2000 tokens.',
                  category: 'Facturation'
                },
                {
                  question: 'L\'AI peut-elle débugger mon code?',
                  answer: 'Oui! Collez votre code avec le message d\'erreur, et l\'AI analysera le problème, expliquera la cause et proposera des solutions. Elle peut même implémenter directement la correction.',
                  category: 'Fonctionnalités'
                },
                {
                  question: 'Puis-je entraîner l\'AI sur mon propre code?',
                  answer: 'Les plans Enterprise permettent le fine-tuning sur votre codebase. Contactez notre équipe commerciale pour plus d\'informations sur cette fonctionnalité.',
                  category: 'Enterprise'
                },
                {
                  question: 'Comment signaler un problème ou suggérer une amélioration?',
                  answer: 'Utilisez le bouton de feedback dans l\'interface, ouvrez un ticket support, ou contactez-nous à support@e-code.app. Nous valorisons vos retours!',
                  category: 'Support'
                }
              ].map((faq, index) => (
                <Collapsible key={index}>
                  <CollapsibleTrigger className="w-full">
                    <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-primary" />
                            <CardTitle className="text-base">{faq.question}</CardTitle>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{faq.category}</Badge>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Card className="mt-2 border-l-4 border-l-primary">
                      <CardContent className="pt-4">
                        <p className="text-sm">{faq.answer}</p>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            <Card className="mt-6 bg-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Besoin d'aide supplémentaire?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button className="w-full" variant="default">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Ouvrir le chat support
                  </Button>
                  <Button className="w-full" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Consulter la documentation complète
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'tutorials':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <h2>Tutoriels Interactifs</h2>
            
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Votre Progression</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progression globale</span>
                      <span className="text-sm text-muted-foreground">3/8 tutoriels complétés</span>
                    </div>
                    <Progress value={37.5} />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Badge className="justify-center">
                      <Trophy className="h-3 w-3 mr-1" />
                      Débutant
                    </Badge>
                    <Badge variant="outline" className="justify-center">
                      <Star className="h-3 w-3 mr-1" />
                      3 Badges
                    </Badge>
                    <Badge variant="outline" className="justify-center">
                      <Clock className="h-3 w-3 mr-1" />
                      2h30 passées
                    </Badge>
                    <Badge variant="outline" className="justify-center">
                      <Code className="h-3 w-3 mr-1" />
                      150 lignes
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {[
                {
                  title: 'Premiers pas avec l\'AI Assistant',
                  level: 'Débutant',
                  duration: '15 min',
                  completed: true,
                  steps: 5,
                  description: 'Apprenez les bases de l\'assistant AI et générez votre premier code'
                },
                {
                  title: 'Créer une application complète',
                  level: 'Intermédiaire',
                  duration: '45 min',
                  completed: true,
                  steps: 8,
                  description: 'Construisez une application full-stack avec l\'aide de l\'AI'
                },
                {
                  title: 'Maîtriser les Custom Prompts',
                  level: 'Intermédiaire',
                  duration: '30 min',
                  completed: true,
                  steps: 6,
                  description: 'Créez et optimisez vos propres templates de prompts'
                },
                {
                  title: 'Debugging avancé avec l\'AI',
                  level: 'Avancé',
                  duration: '25 min',
                  completed: false,
                  steps: 7,
                  description: 'Techniques avancées pour résoudre les bugs complexes'
                },
                {
                  title: 'Optimisation de performances',
                  level: 'Avancé',
                  duration: '40 min',
                  completed: false,
                  steps: 10,
                  description: 'Utilisez l\'AI pour optimiser votre code'
                },
                {
                  title: 'Tests automatisés avec AI',
                  level: 'Intermédiaire',
                  duration: '35 min',
                  completed: false,
                  steps: 9,
                  description: 'Générez des tests complets automatiquement'
                },
                {
                  title: 'Déploiement et CI/CD',
                  level: 'Avancé',
                  duration: '50 min',
                  completed: false,
                  steps: 12,
                  description: 'Configurez un pipeline de déploiement complet'
                },
                {
                  title: 'Projet final: E-commerce',
                  level: 'Expert',
                  duration: '2h',
                  completed: false,
                  steps: 20,
                  description: 'Créez une boutique en ligne complète de A à Z'
                }
              ].map((tutorial, index) => (
                <Card key={index} className={tutorial.completed ? 'opacity-75' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {tutorial.title}
                          {tutorial.completed && <CheckCircle className="h-4 w-4 text-green-500" />}
                        </CardTitle>
                        <CardDescription>{tutorial.description}</CardDescription>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={
                          tutorial.level === 'Débutant' ? 'secondary' :
                          tutorial.level === 'Intermédiaire' ? 'default' :
                          'destructive'
                        }>
                          {tutorial.level}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {tutorial.duration}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>{tutorial.steps} étapes</span>
                        {tutorial.completed ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complété
                          </Badge>
                        ) : (
                          <Button size="sm">
                            Commencer
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Alert className="mt-6">
              <Trophy className="h-4 w-4" />
              <AlertTitle>Défi de la semaine</AlertTitle>
              <AlertDescription>
                Complétez 3 tutoriels supplémentaires pour débloquer le badge "AI Expert" et 
                obtenir 1 mois de plan Pro gratuit!
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Documentation AI</h1>
                <p className="text-muted-foreground">Guide complet des capacités AI d'E-Code</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Rechercher dans la documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[300px]"
                />
              </div>
              <Button variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <aside className="col-span-3">
            <div className="sticky top-24 space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center gap-2",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {section.icon}
                  <span className="font-medium">{section.title}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-9 space-y-12">
            {/* Interactive Components */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Tabs defaultValue="tester" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tester">Testeur de Prompts</TabsTrigger>
                  <TabsTrigger value="comparison">Comparaison de Modèles</TabsTrigger>
                </TabsList>
                <TabsContent value="tester" className="mt-4">
                  <PromptTester />
                </TabsContent>
                <TabsContent value="comparison" className="mt-4">
                  <ModelComparison />
                </TabsContent>
              </Tabs>
            </motion.div>

            <Separator />

            {/* Documentation Sections */}
            {sections.map((section) => (
              <motion.section
                key={section.id}
                ref={(el) => (sectionsRef.current[section.id] = el)}
                id={section.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {renderSectionContent(section.content)}
              </motion.section>
            ))}
          </main>
        </div>
      </div>

      {/* Floating Help Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          className="rounded-full shadow-lg"
          onClick={() => {
            toast({
              title: "Assistant AI",
              description: "Appuyez sur Ctrl+K pour ouvrir l'assistant AI",
            });
          }}
        >
          <Bot className="h-5 w-5 mr-2" />
          Aide AI
        </Button>
      </div>
    </div>
  );
}