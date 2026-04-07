import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LazyMotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  Lock,
  Key,
  AlertCircle,
  Check,
  Search,
  RefreshCw,
  Loader2,
  Save,
  X,
  Upload,
  Download,
  Clock,
  AlertTriangle,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EnvVar {
  id: string;
  projectId: number;
  key: string;
  value: string;
  isSecret: boolean;
  environment: string;
  createdAt?: string;
  updatedAt?: string;
}

interface EnvVarsResponse {
  variables: EnvVar[];
}

type Environment = 'development' | 'production' | 'shared';

const ENVIRONMENT_OPTIONS: { value: Environment; label: string; color: string }[] = [
  { value: 'shared', label: 'All Environments', color: 'bg-blue-500' },
  { value: 'development', label: 'Development', color: 'bg-green-500' },
  { value: 'production', label: 'Production', color: 'bg-red-500' },
];

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <LazyMotionDiv
      className={cn("rounded-lg bg-gray-200 dark:bg-[#242b3d]", className)}
      animate={{
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getEnvironmentBadge(env: string) {
  const config = ENVIRONMENT_OPTIONS.find(e => e.value === env) || ENVIRONMENT_OPTIONS[0];
  return (
    <Badge className={cn(
      "text-[10px] uppercase tracking-wider px-1.5 py-0 rounded text-white border-none",
      config.color
    )}>
      {env === 'shared' ? 'all' : env === 'development' ? 'dev' : 'prod'}
    </Badge>
  );
}

export function ReplitSecretsPanel({ projectId }: { projectId?: string | number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSecret, setEditingSecret] = useState<EnvVar | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isSecretToggle, setIsSecretToggle] = useState(true);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment>('shared');
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealConfirmSecret, setRevealConfirmSecret] = useState<EnvVar | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: envVarsData, isLoading, error, refetch } = useQuery<EnvVarsResponse>({
    queryKey: ['/api/env-vars', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await fetch(`/api/env-vars/${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch environment variables');
      }
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; value: string; isSecret: boolean; environment: string }) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', '/api/env-vars', {
        projectId: projectId.toString(),
        key: data.key.toUpperCase().replace(/\s+/g, '_'),
        value: data.value,
        isSecret: data.isSecret,
        environment: data.environment
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Environment variable created' });
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create environment variable',
        variant: 'destructive'
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value, isSecret, environment }: { id: string; value?: string; isSecret?: boolean; environment?: string }) => {
      const response = await apiRequest('PATCH', `/api/env-vars/${id}`, {
        ...(value !== undefined && { value }),
        ...(isSecret !== undefined && { isSecret }),
        ...(environment !== undefined && { environment })
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Environment variable updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      resetForm();
      setEditingSecret(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update environment variable',
        variant: 'destructive'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/env-vars/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Environment variable deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete environment variable',
        variant: 'destructive'
      });
    }
  });

  const revealMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/env-vars/${id}/reveal`, {});
      return response.json();
    },
    onSuccess: (data, id) => {
      setRevealedSecrets(prev => ({ ...prev, [id]: data.value }));
      toast({
        title: 'Secret Revealed',
        description: 'Value will auto-hide in 60 seconds'
      });
      setTimeout(() => {
        setRevealedSecrets(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }, 60000);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reveal secret',
        variant: 'destructive'
      });
    }
  });

  const importMutation = useMutation({
    mutationFn: async (data: { content: string; environment: string }) => {
      if (!projectId) throw new Error('Project ID required');
      const response = await apiRequest('POST', `/api/env-vars/${projectId}/import`, {
        content: data.content,
        environment: data.environment
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Import Complete', 
        description: `Imported ${data.imported} variables, ${data.skipped} skipped` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/env-vars', projectId] });
      setShowImportDialog(false);
      setImportContent('');
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import environment variables',
        variant: 'destructive'
      });
    }
  });

  const resetForm = useCallback(() => {
    setNewKey('');
    setNewValue('');
    setIsSecretToggle(true);
    setSelectedEnvironment('shared');
  }, []);

  const handleCopyValue = useCallback((secret: EnvVar) => {
    const valueToCopy = revealedSecrets[secret.id] || secret.value;
    if (valueToCopy === '********') {
      toast({
        title: 'Cannot copy',
        description: 'Reveal the secret first to copy its value',
        variant: 'destructive'
      });
      return;
    }
    navigator.clipboard.writeText(valueToCopy);
    setCopiedId(secret.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copied', description: 'Value copied to clipboard' });
  }, [revealedSecrets, toast]);

  const handleToggleReveal = useCallback((secret: EnvVar) => {
    if (revealedSecrets[secret.id]) {
      setRevealedSecrets(prev => {
        const newState = { ...prev };
        delete newState[secret.id];
        return newState;
      });
    } else if (secret.isSecret) {
      setRevealConfirmSecret(secret);
    }
  }, [revealedSecrets]);

  const confirmReveal = useCallback(() => {
    if (revealConfirmSecret) {
      revealMutation.mutate(revealConfirmSecret.id);
      setRevealConfirmSecret(null);
    }
  }, [revealConfirmSecret, revealMutation]);

  const handleExport = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/env-vars/${projectId}/export`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '.env';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Exported', description: 'Environment file downloaded' });
      setShowExportWarning(false);
    } catch (error: any) {
      toast({
        title: 'Export Failed',
        description: error.message || 'Failed to export environment variables',
        variant: 'destructive'
      });
    }
  }, [projectId, toast]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportContent(content);
    };
    reader.readAsText(file);
  }, []);

  const parseEnvContent = (content: string): { key: string; value: string }[] => {
    return content
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('#'))
      .map(line => {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) return null;
        const key = line.substring(0, eqIndex).trim();
        let value = line.substring(eqIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return { key, value };
      })
      .filter((item): item is { key: string; value: string } => item !== null);
  };

  const variables = envVarsData?.variables || [];
  const filteredVariables = variables.filter(v => {
    const matchesSearch = v.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEnv = filterEnvironment === 'all' || v.environment === filterEnvironment;
    return matchesSearch && matchesEnv;
  });

  if (!projectId) {
    return (
      <div 
        className="h-full flex flex-col items-center justify-center p-3 bg-gray-50 dark:bg-[#0e1525]" 
        data-testid="secrets-panel-no-project"
      >
        <Lock className="w-[48px] h-[48px] mb-4 text-gray-400 dark:text-[#5c6670] opacity-40" />
        <p className="text-[15px] leading-[20px] text-gray-600 dark:text-[#9da2a6]">
          Select a project to manage secrets
        </p>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col bg-[var(--ecode-surface)]" 
      data-testid="secrets-panel"
    >
      <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text)]">Secrets</span>
          <Badge className="h-4 text-[9px] px-1 bg-[var(--ecode-sidebar-hover)] text-[var(--ecode-text-muted)] border-none">
            {variables.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            className="h-7 w-7 rounded p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setShowImportDialog(true)}
            title="Import from .env file"
            data-testid="button-import-secrets"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            className="h-7 w-7 rounded p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => setShowExportWarning(true)}
            title="Export to .env file"
            data-testid="button-export-secrets"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            className="h-7 w-7 rounded p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-secrets"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </Button>
          <Button
            className="h-7 rounded px-2 text-[10px] bg-[hsl(142,72%,42%)] hover:bg-[hsl(142,72%,38%)] text-white"
            onClick={() => setShowAddDialog(true)}
            data-testid="button-add-secret"
          >
            <Plus className="w-3.5 h-3.5 mr-0.5" />
            Add
          </Button>
        </div>
      </div>

      <div className="px-2.5 py-1.5 border-b border-[var(--ecode-border)] shrink-0">

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search 
              className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400 dark:text-[#5c6670]" 
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search secrets..."
              className="pl-10 h-8 rounded-lg text-[13px] border bg-white dark:bg-[#1c2333] border-gray-300 dark:border-[#3d4452] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#5c6670]"
              data-testid="input-search-secrets"
            />
          </div>
          <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
            <SelectTrigger className="w-[120px] h-8 text-[13px] bg-white dark:bg-[#1c2333] border-gray-300 dark:border-[#3d4452]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Envs</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="development">Dev</SelectItem>
              <SelectItem value="production">Prod</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <ShimmerSkeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="w-[48px] h-[48px] mb-3 text-red-500 opacity-40" />
              <p className="text-[15px] leading-[20px] text-gray-600 dark:text-[#9da2a6]">
                Failed to load secrets
              </p>
              <Button 
                variant="link" 
                className="text-[13px] mt-2 text-blue-600 dark:text-[#0079f2]"
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </div>
          ) : filteredVariables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Lock 
                className="w-[48px] h-[48px] mb-4 text-gray-400 dark:text-[#5c6670] opacity-40" 
              />
              <h4 className="text-[17px] font-medium leading-tight mb-2 text-gray-900 dark:text-white">
                {searchQuery ? 'No matching secrets' : 'No secrets configured'}
              </h4>
              <p className="text-[13px] mb-4 text-gray-600 dark:text-[#9da2a6]">
                {searchQuery 
                  ? 'Try adjusting your search query' 
                  : 'Store sensitive data like API keys and tokens securely'}
              </p>
              {!searchQuery && (
                <Button
                  className="h-8 rounded-lg px-4 text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="w-[18px] h-[18px] mr-1" />
                  Add your first secret
                </Button>
              )}
            </div>
          ) : (
            filteredVariables.map((secret) => (
              <div
                key={secret.id}
                className="mb-2 p-3 rounded-lg transition-colors bg-white dark:bg-[#1c2333] border border-gray-200 dark:border-[#3d4452]"
                data-testid={`secret-item-${secret.key}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {secret.isSecret ? (
                        <Lock className="w-[16px] h-[16px] shrink-0 text-amber-500" />
                      ) : (
                        <Key className="w-[16px] h-[16px] shrink-0 text-gray-500 dark:text-[#9da2a6]" />
                      )}
                      <span 
                        className="font-mono text-[14px] leading-[18px] font-medium truncate text-gray-900 dark:text-white"
                      >
                        {secret.key}
                      </span>
                      {secret.isSecret && (
                        <Badge 
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0 rounded bg-transparent text-amber-500 border border-amber-500"
                        >
                          encrypted
                        </Badge>
                      )}
                      {getEnvironmentBadge(secret.environment || 'shared')}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code 
                        className="text-[12px] font-mono px-2 py-1 rounded max-w-[180px] truncate bg-gray-100 dark:bg-[#242b3d] text-gray-600 dark:text-[#9da2a6]"
                      >
                        {revealedSecrets[secret.id] || secret.value}
                      </code>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500 dark:text-[#5c6670]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-[12px] h-[12px]" />
                        Created {formatRelativeTime(secret.createdAt)}
                      </span>
                      {secret.updatedAt && secret.updatedAt !== secret.createdAt && (
                        <span className="flex items-center gap-1">
                          <Edit className="w-[12px] h-[12px]" />
                          Modified {formatRelativeTime(secret.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {secret.isSecret && (
                      <Button
                        variant="ghost"
                        className="h-8 w-8 rounded-lg p-0 text-gray-500 dark:text-[#9da2a6] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#242b3d]"
                        onClick={() => handleToggleReveal(secret)}
                        disabled={revealMutation.isPending}
                        data-testid={`button-reveal-${secret.key}`}
                      >
                        {revealMutation.isPending && revealMutation.variables === secret.id ? (
                          <Loader2 className="w-[18px] h-[18px] animate-spin" />
                        ) : revealedSecrets[secret.id] ? (
                          <EyeOff className="w-[18px] h-[18px]" />
                        ) : (
                          <Eye className="w-[18px] h-[18px]" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="h-8 w-8 rounded-lg p-0 text-gray-500 dark:text-[#9da2a6] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#242b3d]"
                      onClick={() => handleCopyValue(secret)}
                      data-testid={`button-copy-${secret.key}`}
                    >
                      {copiedId === secret.id ? (
                        <Check className="w-[18px] h-[18px] text-green-500" />
                      ) : (
                        <Copy className="w-[18px] h-[18px]" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 rounded-lg p-0 text-gray-500 dark:text-[#9da2a6] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#242b3d]"
                      onClick={() => {
                        setEditingSecret(secret);
                        setNewKey(secret.key);
                        setNewValue('');
                        setIsSecretToggle(secret.isSecret);
                        setSelectedEnvironment((secret.environment || 'shared') as Environment);
                      }}
                      data-testid={`button-edit-${secret.key}`}
                    >
                      <Edit className="w-[18px] h-[18px]" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 rounded-lg p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => deleteMutation.mutate(secret.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${secret.key}`}
                    >
                      {deleteMutation.isPending && deleteMutation.variables === secret.id ? (
                        <Loader2 className="w-[18px] h-[18px] animate-spin" />
                      ) : (
                        <Trash2 className="w-[18px] h-[18px]" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-white dark:bg-[#1c2333] border-gray-200 dark:border-[#3d4452]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-medium leading-tight text-gray-900 dark:text-white">
              Add Environment Variable
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-[20px] text-gray-600 dark:text-[#9da2a6]">
              Add a new environment variable or secret to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Key
              </Label>
              <Input
                id="key"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder="MY_SECRET_KEY"
                className="font-mono h-8 rounded-lg text-[15px] border bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452] text-gray-900 dark:text-white"
                data-testid="input-new-key"
              />
              <p className="text-[13px] text-gray-500 dark:text-[#5c6670]">
                Uppercase with underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Value
              </Label>
              <Input
                id="value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
                type={isSecretToggle ? 'password' : 'text'}
                className="h-8 rounded-lg text-[15px] border bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452] text-gray-900 dark:text-white"
                data-testid="input-new-value"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Environment
              </Label>
              <Select value={selectedEnvironment} onValueChange={(v) => setSelectedEnvironment(v as Environment)}>
                <SelectTrigger className="h-8 text-[13px] bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[13px] text-gray-500 dark:text-[#5c6670]">
                Shared applies to all environments
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[15px] leading-[20px] text-gray-900 dark:text-white">
                Encrypt as secret
              </Label>
              <Switch
                id="isSecret"
                checked={isSecretToggle}
                onCheckedChange={setIsSecretToggle}
                data-testid="switch-is-secret"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              className="h-8 rounded-lg text-[13px] border border-gray-300 dark:border-[#3d4452] text-gray-600 dark:text-[#9da2a6] bg-transparent hover:bg-gray-100 dark:hover:bg-[#242b3d]"
              onClick={() => { setShowAddDialog(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-lg text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => createMutation.mutate({ key: newKey, value: newValue, isSecret: isSecretToggle, environment: selectedEnvironment })}
              disabled={!newKey || !newValue || createMutation.isPending}
              data-testid="button-save-secret"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-[18px] h-[18px] mr-1 animate-spin" /> Saving...</>
              ) : (
                <><Save className="w-[18px] h-[18px] mr-1" /> Save</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSecret} onOpenChange={(open) => { if (!open) { setEditingSecret(null); resetForm(); } }}>
        <DialogContent className="bg-white dark:bg-[#1c2333] border-gray-200 dark:border-[#3d4452]">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-medium leading-tight text-gray-900 dark:text-white">
              Edit Environment Variable
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-[20px] text-gray-600 dark:text-[#9da2a6]">
              Update the value for {editingSecret?.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Key
              </Label>
              <div 
                className="font-mono text-[15px] leading-[20px] px-3 py-2 rounded-lg bg-gray-100 dark:bg-[#242b3d] text-gray-900 dark:text-white"
              >
                {editingSecret?.key}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                New Value
              </Label>
              <Input
                id="editValue"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter new value..."
                type={isSecretToggle ? 'password' : 'text'}
                className="h-8 rounded-lg text-[15px] border bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452] text-gray-900 dark:text-white"
                data-testid="input-edit-value"
              />
              <p className="text-[13px] text-gray-500 dark:text-[#5c6670]">
                Leave empty to keep current value
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Environment
              </Label>
              <Select value={selectedEnvironment} onValueChange={(v) => setSelectedEnvironment(v as Environment)}>
                <SelectTrigger className="h-8 text-[13px] bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[15px] leading-[20px] text-gray-900 dark:text-white">
                Encrypt as secret
              </Label>
              <Switch
                id="editIsSecret"
                checked={isSecretToggle}
                onCheckedChange={setIsSecretToggle}
                data-testid="switch-edit-is-secret"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              className="h-8 rounded-lg text-[13px] border border-gray-300 dark:border-[#3d4452] text-gray-600 dark:text-[#9da2a6] bg-transparent hover:bg-gray-100 dark:hover:bg-[#242b3d]"
              onClick={() => { setEditingSecret(null); resetForm(); }}
            >
              Cancel
            </Button>
            <Button
              className="h-8 rounded-lg text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (editingSecret) {
                  updateMutation.mutate({
                    id: editingSecret.id,
                    ...(newValue && { value: newValue }),
                    isSecret: isSecretToggle,
                    environment: selectedEnvironment
                  });
                }
              }}
              disabled={updateMutation.isPending}
              data-testid="button-update-secret"
            >
              {updateMutation.isPending ? (
                <><Loader2 className="w-[18px] h-[18px] mr-1 animate-spin" /> Updating...</>
              ) : (
                <><Save className="w-[18px] h-[18px] mr-1" /> Update</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revealConfirmSecret} onOpenChange={(open) => !open && setRevealConfirmSecret(null)}>
        <AlertDialogContent className="bg-white dark:bg-[#1c2333] border-gray-200 dark:border-[#3d4452]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Reveal Secret Value?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-[#9da2a6]">
              You are about to reveal the encrypted value for <strong className="text-gray-900 dark:text-white">{revealConfirmSecret?.key}</strong>.
              <br /><br />
              This action will be logged for security purposes. The value will auto-hide after 60 seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmReveal}
              className="h-8 text-[13px] bg-amber-600 hover:bg-amber-700"
            >
              <Eye className="w-4 h-4 mr-1" />
              Reveal Secret
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-white dark:bg-[#1c2333] border-gray-200 dark:border-[#3d4452] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <Upload className="w-5 h-5" />
              Import Environment Variables
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-[#9da2a6]">
              Import variables from a .env file. Each line should be KEY=VALUE format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-8 text-[13px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".env,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <span className="text-[13px] text-gray-500">or paste content below</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                .env Content
              </Label>
              <Textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder="API_KEY=your-api-key&#10;DATABASE_URL=postgres://..."
                className="h-40 font-mono text-[13px] bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452]"
              />
              {importContent && (
                <p className="text-[12px] text-gray-500">
                  {parseEnvContent(importContent).length} variables detected
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] uppercase tracking-wider text-gray-600 dark:text-[#9da2a6]">
                Import to Environment
              </Label>
              <Select value={selectedEnvironment} onValueChange={(v) => setSelectedEnvironment(v as Environment)}>
                <SelectTrigger className="h-8 text-[13px] bg-gray-100 dark:bg-[#242b3d] border-gray-300 dark:border-[#3d4452]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              className="h-8 text-[13px]"
              onClick={() => { setShowImportDialog(false); setImportContent(''); }}
            >
              Cancel
            </Button>
            <Button
              className="h-8 text-[13px] bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => importMutation.mutate({ content: importContent, environment: selectedEnvironment })}
              disabled={!importContent.trim() || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-1" /> Import</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showExportWarning} onOpenChange={setShowExportWarning}>
        <AlertDialogContent className="bg-white dark:bg-[#1c2333] border-gray-200 dark:border-[#3d4452]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Export Security Warning
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-[#9da2a6]">
              <strong className="text-amber-600">Warning:</strong> Exporting will download a .env file containing <strong>all secrets in plain text</strong>.
              <br /><br />
              This file should:
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Never be committed to version control</li>
                <li>Never be shared over insecure channels</li>
                <li>Be deleted after use</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[13px]">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleExport}
              className="h-8 text-[13px] bg-amber-600 hover:bg-amber-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Export Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
