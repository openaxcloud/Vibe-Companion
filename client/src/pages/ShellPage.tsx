import { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import {
  TerminalSquare,
  Settings,
  Key,
  FolderTree,
  Play,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  FolderOpen,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Server,
  Link,
  Wifi,
  WifiOff,
  Save,
  Upload,
  Download,
  Edit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Zap,
  Code,
  FileText,
  Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
  source: 'system' | 'user' | 'project';
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  script: string;
  language: string;
}

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'connected' | 'disconnected' | 'connecting';
}


const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'start-dev',
    name: 'Start Development Server',
    description: 'Start the development server with hot reload',
    script: 'npm run dev',
    language: 'bash',
  },
  {
    id: 'build',
    name: 'Build Project',
    description: 'Build the project for production',
    script: 'npm run build',
    language: 'bash',
  },
  {
    id: 'test',
    name: 'Run Tests',
    description: 'Execute the test suite',
    script: 'npm test',
    language: 'bash',
  },
  {
    id: 'lint',
    name: 'Lint Code',
    description: 'Check code for style issues',
    script: 'npm run lint',
    language: 'bash',
  },
  {
    id: 'db-migrate',
    name: 'Database Migration',
    description: 'Run database migrations',
    script: 'npm run db:migrate',
    language: 'bash',
  },
  {
    id: 'docker-build',
    name: 'Docker Build',
    description: 'Build Docker image',
    script: 'docker build -t myapp .',
    language: 'bash',
  },
  {
    id: 'git-status',
    name: 'Git Status',
    description: 'Check Git repository status',
    script: 'git status && git log --oneline -5',
    language: 'bash',
  },
  {
    id: 'clean-deps',
    name: 'Clean Dependencies',
    description: 'Remove and reinstall dependencies',
    script: 'rm -rf node_modules && npm install',
    language: 'bash',
  },
];

export default function ShellPage() {
  const { toast } = useToast();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [activeTab, setActiveTab] = useState('shell');
  const [currentPath, setCurrentPath] = useState('/home/user/project');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [sshConnections, setSshConnections] = useState<SSHConnection[]>([]);
  const [showAddEnvDialog, setShowAddEnvDialog] = useState(false);
  const [showSSHDialog, setShowSSHDialog] = useState(false);
  const [showScriptEditor, setShowScriptEditor] = useState(false);
  const [selectedScript, setSelectedScript] = useState<ScriptTemplate | null>(null);
  const [customScript, setCustomScript] = useState('');
  const [newEnvVar, setNewEnvVar] = useState({ key: '', value: '', isSecret: false });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [runningScripts, setRunningScripts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, Monaco, Consolas, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#1a1b26',
        foreground: '#c0caf5',
        cursor: '#c0caf5',
        black: '#414868',
        red: '#f7768e',
        green: '#9ece6a',
        yellow: '#e0af68',
        blue: '#7aa2f7',
        magenta: '#bb9af7',
        cyan: '#7dcfff',
        white: '#a9b1d6',
      },
      scrollback: 10000,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    const webLinks = new WebLinksAddon();
    term.loadAddon(webLinks);

    term.open(terminalRef.current);
    fit.fit();

    term.writeln('\x1b[1;32mE-Code Shell v2.0\x1b[0m');
    term.writeln('\x1b[90mInteractive shell environment\x1b[0m');
    term.writeln('');
    term.write(`\x1b[1;34m${currentPath} $\x1b[0m `);

    setTerminal(term);
    setFitAddon(fit);

    const handleResize = () => {
      if (fit) fit.fit();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  const toggleDir = (path: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const toggleSecretVisibility = (key: string) => {
    const newShowSecrets = new Set(showSecrets);
    if (newShowSecrets.has(key)) {
      newShowSecrets.delete(key);
    } else {
      newShowSecrets.add(key);
    }
    setShowSecrets(newShowSecrets);
  };

  const copyValue = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({ title: 'Copied', description: 'Value copied to clipboard' });
  };

  const runScript = (script: ScriptTemplate) => {
    if (terminal) {
      terminal.writeln('');
      terminal.writeln(`\x1b[1;33m> Running: ${script.name}\x1b[0m`);
      terminal.writeln(`\x1b[90m$ ${script.script}\x1b[0m`);
      setRunningScripts(new Set([...runningScripts, script.id]));

      setTimeout(() => {
        terminal.writeln('\x1b[1;32m✓ Script completed successfully\x1b[0m');
        terminal.write(`\x1b[1;34m${currentPath} $\x1b[0m `);
        setRunningScripts((prev) => {
          const next = new Set(prev);
          next.delete(script.id);
          return next;
        });
      }, 2000);
    }
  };

  const stopScript = (scriptId: string) => {
    setRunningScripts((prev) => {
      const next = new Set(prev);
      next.delete(scriptId);
      return next;
    });
    if (terminal) {
      terminal.writeln('\x1b[1;31m✗ Script stopped\x1b[0m');
      terminal.write(`\x1b[1;34m${currentPath} $\x1b[0m `);
    }
    toast({ title: 'Script Stopped', description: 'The script has been terminated' });
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
    if (terminal) {
      terminal.writeln('');
      terminal.writeln(`\x1b[90mcd ${path}\x1b[0m`);
      terminal.write(`\x1b[1;34m${path} $\x1b[0m `);
    }
  };

  const addEnvVar = () => {
    if (!newEnvVar.key.trim()) {
      toast({ title: 'Error', description: 'Variable name is required', variant: 'destructive' });
      return;
    }
    setEnvVars([...envVars, { ...newEnvVar, source: 'user' }]);
    setNewEnvVar({ key: '', value: '', isSecret: false });
    setShowAddEnvDialog(false);
    toast({ title: 'Variable Added', description: `${newEnvVar.key} has been added` });
  };

  const deleteEnvVar = (key: string) => {
    setEnvVars(envVars.filter((v) => v.key !== key));
    toast({ title: 'Variable Deleted', description: `${key} has been removed` });
  };

  const connectSSH = (connectionId: string) => {
    setSshConnections(
      sshConnections.map((conn) =>
        conn.id === connectionId ? { ...conn, status: 'connecting' } : conn
      )
    );

    setTimeout(() => {
      setSshConnections(
        sshConnections.map((conn) =>
          conn.id === connectionId ? { ...conn, status: 'connected' } : conn
        )
      );
      toast({ title: 'Connected', description: 'SSH connection established' });
    }, 1500);
  };

  const disconnectSSH = (connectionId: string) => {
    setSshConnections(
      sshConnections.map((conn) =>
        conn.id === connectionId ? { ...conn, status: 'disconnected' } : conn
      )
    );
    toast({ title: 'Disconnected', description: 'SSH connection closed' });
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleDir(node.path);
            } else {
              navigateToPath(node.path.split('/').slice(0, -1).join('/') || '/');
            }
          }}
          data-testid={`file-node-${node.name}`}
        >
          {node.type === 'directory' ? (
            expandedDirs.has(node.path) ? (
              <>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                <FolderOpen className="h-4 w-4 text-blue-500" />
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Folder className="h-4 w-4 text-blue-500" />
              </>
            )
          ) : (
            <>
              <span className="w-3" />
              <FileCode className="h-4 w-4 text-muted-foreground" />
            </>
          )}
          <span className="text-[13px]">{node.name}</span>
        </div>
        {node.type === 'directory' && expandedDirs.has(node.path) && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const getSourceBadgeColor = (source: EnvVariable['source']) => {
    switch (source) {
      case 'system':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'project':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'user':
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Shell Environment"
        description="Interactive shell with SSH connections, environment variables, and script execution."
        icon={TerminalSquare}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddEnvDialog(true)}
              data-testid="button-add-env-var"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSSHDialog(true)}
              data-testid="button-ssh-connections"
            >
              <Server className="h-4 w-4 mr-2" />
              SSH
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedScript(null);
                setCustomScript('');
                setShowScriptEditor(true);
              }}
              data-testid="button-new-script"
            >
              <Code className="h-4 w-4 mr-2" />
              New Script
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card data-testid="card-file-navigator">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                File Navigator
              </CardTitle>
              <CardDescription>Current: {currentPath}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <div className="p-2">
                  {fileTree.length > 0 ? (
                    renderFileTree(fileTree)
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground p-4 text-center">
                      <FolderTree className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-[13px]">No files found</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card data-testid="card-ssh-connections">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" />
                SSH Connections
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sshConnections.length > 0 ? (
                sshConnections.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between p-2 rounded-lg border"
                    data-testid={`ssh-connection-${conn.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {conn.status === 'connected' ? (
                        <Wifi className="h-4 w-4 text-green-500" />
                      ) : conn.status === 'connecting' ? (
                        <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-[13px] font-medium">{conn.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {conn.username}@{conn.host}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={conn.status === 'connected' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() =>
                        conn.status === 'connected' ? disconnectSSH(conn.id) : connectSSH(conn.id)
                      }
                      disabled={conn.status === 'connecting'}
                      data-testid={`ssh-toggle-${conn.id}`}
                    >
                      {conn.status === 'connected' ? 'Disconnect' : 'Connect'}
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 border rounded-lg border-dashed">
                  <Server className="h-8 w-8 mx-auto text-muted-foreground opacity-20 mb-2" />
                  <p className="text-[13px] text-muted-foreground">No SSH connections</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1"
                    onClick={() => setShowSSHDialog(true)}
                  >
                    Add Connection
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4" data-testid="tabs-shell">
              <TabsTrigger value="shell" data-testid="tab-shell">
                <TerminalSquare className="h-4 w-4 mr-2" />
                Shell
              </TabsTrigger>
              <TabsTrigger value="env" data-testid="tab-env">
                <Key className="h-4 w-4 mr-2" />
                Environment
              </TabsTrigger>
              <TabsTrigger value="scripts" data-testid="tab-scripts">
                <Zap className="h-4 w-4 mr-2" />
                Scripts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="shell">
              <Card data-testid="card-shell-terminal">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <TerminalSquare className="h-4 w-4" />
                    <span className="text-[13px] font-medium">Interactive Shell</span>
                    <Badge variant="secondary" className="text-[11px]">
                      bash
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (terminal) {
                          terminal.clear();
                          terminal.write(`\x1b[1;34m${currentPath} $\x1b[0m `);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        if (terminal && fitAddon) fitAddon.fit();
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div
                  ref={terminalRef}
                  className="p-2"
                  style={{ minHeight: '400px' }}
                  data-testid="shell-terminal-container"
                />
              </Card>
            </TabsContent>

            <TabsContent value="env">
              <Card data-testid="card-env-vars">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Environment Variables</CardTitle>
                      <CardDescription>
                        Manage environment variables for your project
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddEnvDialog(true)}
                      data-testid="button-add-env-inline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Variable
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {envVars.length > 0 ? (
                      envVars.map((envVar) => (
                        <div
                          key={envVar.key}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`env-var-${envVar.key}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {envVar.isSecret ? (
                              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <code className="font-medium text-[13px]">{envVar.key}</code>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${getSourceBadgeColor(envVar.source)}`}
                                >
                                  {envVar.source}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <code className="text-[11px] text-muted-foreground truncate">
                                  {envVar.isSecret && !showSecrets.has(envVar.key)
                                    ? '••••••••'
                                    : envVar.value}
                                </code>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {envVar.isSecret && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleSecretVisibility(envVar.key)}
                              >
                                {showSecrets.has(envVar.key) ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyValue(envVar.value, envVar.key)}
                            >
                              {copiedKey === envVar.key ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            {envVar.source === 'user' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => deleteEnvVar(envVar.key)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 border rounded-xl border-dashed">
                        <Key className="h-10 w-10 mx-auto text-muted-foreground opacity-20 mb-3" />
                        <h3 className="text-[13px] font-medium">No Environment Variables</h3>
                        <p className="text-[11px] text-muted-foreground mt-1 mb-4">
                          Add variables to configure your shell environment
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddEnvDialog(true)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Add Variable
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scripts">
              <Card data-testid="card-script-runner">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Script Runner</CardTitle>
                      <CardDescription>
                        Execute pre-defined or custom scripts
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedScript(null);
                        setCustomScript('');
                        setShowScriptEditor(true);
                      }}
                      data-testid="button-create-script"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Script
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SCRIPT_TEMPLATES.map((script) => (
                      <Card
                        key={script.id}
                        className="p-4 hover:bg-muted/50 transition-colors"
                        data-testid={`script-template-${script.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <h4 className="font-medium text-[13px]">{script.name}</h4>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {script.description}
                            </p>
                            <code className="text-[11px] text-muted-foreground mt-2 block truncate">
                              $ {script.script}
                            </code>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {runningScripts.has(script.id) ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => stopScript(script.id)}
                                data-testid={`button-stop-${script.id}`}
                              >
                                <Square className="h-3 w-3 mr-1" />
                                Stop
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => runScript(script)}
                                data-testid={`button-run-${script.id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Run
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showAddEnvDialog} onOpenChange={setShowAddEnvDialog}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-add-env">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Add Environment Variable
            </DialogTitle>
            <DialogDescription>
              Add a new environment variable to your project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="env-key">Variable Name</Label>
              <Input
                id="env-key"
                placeholder="MY_VARIABLE"
                value={newEnvVar.key}
                onChange={(e) => setNewEnvVar({ ...newEnvVar, key: e.target.value.toUpperCase() })}
                data-testid="input-env-key"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="env-value">Value</Label>
              <Input
                id="env-value"
                type={newEnvVar.isSecret ? 'password' : 'text'}
                placeholder="Enter value..."
                value={newEnvVar.value}
                onChange={(e) => setNewEnvVar({ ...newEnvVar, value: e.target.value })}
                data-testid="input-env-value"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Secret Value</Label>
                <p className="text-[11px] text-muted-foreground">Hide value by default</p>
              </div>
              <Switch
                checked={newEnvVar.isSecret}
                onCheckedChange={(checked) => setNewEnvVar({ ...newEnvVar, isSecret: checked })}
                data-testid="switch-env-secret"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddEnvDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addEnvVar} data-testid="button-save-env">
              <Save className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSSHDialog} onOpenChange={setShowSSHDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="dialog-ssh">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              SSH Connections
            </DialogTitle>
            <DialogDescription>
              Manage your SSH connections
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {sshConnections.length > 0 ? (
              sshConnections.map((conn) => (
                <Card key={conn.id} className="p-4" data-testid={`ssh-dialog-conn-${conn.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {conn.status === 'connected' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : conn.status === 'connecting' ? (
                        <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{conn.name}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {conn.username}@{conn.host}:{conn.port}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={conn.status === 'connected' ? 'destructive' : 'default'}
                        size="sm"
                        onClick={() =>
                          conn.status === 'connected'
                            ? disconnectSSH(conn.id)
                            : connectSSH(conn.id)
                        }
                        disabled={conn.status === 'connecting'}
                      >
                        {conn.status === 'connected' ? 'Disconnect' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                <Server className="h-12 w-12 text-muted-foreground opacity-20 mb-3" />
                <p className="text-muted-foreground text-[13px]">No SSH connections configured</p>
              </div>
            )}
            <Button variant="outline" className="w-full" data-testid="button-add-ssh">
              <Plus className="h-4 w-4 mr-2" />
              Add New Connection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showScriptEditor} onOpenChange={setShowScriptEditor}>
        <DialogContent className="sm:max-w-2xl" data-testid="dialog-script-editor">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              {selectedScript ? 'Edit Script' : 'Create Script'}
            </DialogTitle>
            <DialogDescription>
              Write a custom script to execute
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="script-name">Script Name</Label>
              <Input
                id="script-name"
                placeholder="My Custom Script"
                data-testid="input-script-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="script-content">Script Content</Label>
              <Textarea
                id="script-content"
                placeholder="#!/bin/bash&#10;echo 'Hello World'"
                className="font-mono min-h-[200px]"
                value={customScript}
                onChange={(e) => setCustomScript(e.target.value)}
                data-testid="textarea-script-content"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowScriptEditor(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (customScript && terminal) {
                  terminal.writeln('');
                  terminal.writeln('\x1b[1;33m> Running custom script\x1b[0m');
                  terminal.writeln(`\x1b[90m${customScript}\x1b[0m`);
                  setTimeout(() => {
                    terminal.writeln('\x1b[1;32m✓ Script completed\x1b[0m');
                    terminal.write(`\x1b[1;34m${currentPath} $\x1b[0m `);
                  }, 1000);
                }
                setShowScriptEditor(false);
              }}
              data-testid="button-run-custom-script"
            >
              <Play className="h-4 w-4 mr-2" />
              Run Script
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
