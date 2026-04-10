import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Key,
  AlertCircle,
  CheckCircle,
  Lock,
  Unlock,
  Database,
  Cloud,
  Globe,
  Terminal,
  FileText,
  Settings
} from 'lucide-react';

interface Secret {
  id: number;
  name: string;
  value?: string;
  description?: string;
  category: string;
  lastUpdated: string;
  isRevealed?: boolean;
  usageCount: number;
  scope: 'project' | 'workspace' | 'global';
}

interface SecretCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const SECRET_CATEGORIES: SecretCategory[] = [
  { id: 'api', name: 'API Keys', icon: <Key className="w-4 h-4" />, description: 'External service API keys' },
  { id: 'database', name: 'Database', icon: <Database className="w-4 h-4" />, description: 'Database connection strings' },
  { id: 'cloud', name: 'Cloud Services', icon: <Cloud className="w-4 h-4" />, description: 'Cloud provider credentials' },
  { id: 'auth', name: 'Authentication', icon: <Lock className="w-4 h-4" />, description: 'OAuth and auth tokens' },
  { id: 'deployment', name: 'Deployment', icon: <Globe className="w-4 h-4" />, description: 'Deployment configurations' },
  { id: 'other', name: 'Other', icon: <Settings className="w-4 h-4" />, description: 'Other environment variables' },
];

interface SecretManagementProps {
  projectId: string;
}

export function SecretManagement({ projectId }: SecretManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch secrets - REAL BACKEND
  const { data: secrets = [], isLoading } = useQuery({
    queryKey: ['/api/secrets'],
    enabled: true
  });

  // Create secret mutation - REAL BACKEND
  const createSecretMutation = useMutation({
    mutationFn: (secretData: Partial<Secret>) => 
      apiRequest('POST', '/api/secrets', secretData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      toast({
        title: "Secret Created",
        description: "Your secret has been securely stored.",
      });
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create secret.",
        variant: "destructive",
      });
    }
  });

  // Update secret mutation - REAL BACKEND
  const updateSecretMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Secret> & { id: number }) => 
      apiRequest('PUT', `/api/secrets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      toast({
        title: "Secret Updated",
        description: "Your secret has been updated.",
      });
      setEditingSecret(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update secret.",
        variant: "destructive",
      });
    }
  });

  // Delete secret mutation - REAL BACKEND
  const deleteSecretMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/secrets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/secrets'] });
      toast({
        title: "Secret Deleted",
        description: "The secret has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete secret.",
        variant: "destructive",
      });
    }
  });

  const toggleRevealSecret = (secretId: number) => {
    setRevealedSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secretId)) {
        newSet.delete(secretId);
      } else {
        newSet.add(secretId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (value: string, name: string) => {
    navigator.clipboard.writeText(value);
    toast({
      description: `${name} copied to clipboard`,
      duration: 2000,
    });
  };

  const filteredSecrets = (secrets as Secret[]).filter((secret: Secret) => {
    const matchesCategory = selectedCategory === 'all' || secret.category === selectedCategory;
    const matchesSearch = secret.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         secret.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const SecretForm = ({ secret, onSubmit }: { secret?: Secret | null, onSubmit: (data: any) => void }) => {
    const [formData, setFormData] = useState({
      name: secret?.name || '',
      value: secret?.value || '',
      description: secret?.description || '',
      category: secret?.category || 'api',
      scope: secret?.scope || 'project'
    });

    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Secret Name</Label>
            <Input
              id="name"
              placeholder="e.g., OPENAI_API_KEY"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <p className="text-[13px] text-muted-foreground mt-1">
              Use UPPER_SNAKE_CASE for environment variables
            </p>
          </div>
          
          <div>
            <Label htmlFor="value">Secret Value</Label>
            <Textarea
              id="value"
              placeholder="Enter your secret value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
              className="font-mono"
              rows={3}
            />
          </div>
          
          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              className="w-full p-2 border rounded-md"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {SECRET_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <Label htmlFor="scope">Scope</Label>
            <select
              id="scope"
              className="w-full p-2 border rounded-md"
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as any })}
            >
              <option value="project">Project only</option>
              <option value="workspace">Workspace</option>
              <option value="global">Global</option>
            </select>
          </div>
          
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What is this secret used for?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
        
        <DialogFooter className="mt-6">
          <Button type="submit">
            {secret ? 'Update Secret' : 'Create Secret'}
          </Button>
        </DialogFooter>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Secret Management
              </CardTitle>
              <CardDescription>
                Securely manage API keys, tokens, and environment variables
              </CardDescription>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Secret
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Secret</DialogTitle>
                  <DialogDescription>
                    Create a new secret that will be available as an environment variable
                  </DialogDescription>
                </DialogHeader>
                <SecretForm onSubmit={(data) => createSecretMutation.mutate(data)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="flex gap-4">
              <Input
                placeholder="Search secrets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              
              <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  {SECRET_CATEGORIES.map(cat => (
                    <TabsTrigger key={cat.id} value={cat.id}>
                      {cat.icon}
                      <span className="ml-2">{cat.name}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            
            {/* Secrets table */}
            {isLoading ? (
              <div className="text-center py-8">Loading secrets...</div>
            ) : filteredSecrets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No secrets found matching your criteria' 
                  : 'No secrets yet. Add your first secret to get started.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSecrets.map((secret: Secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="font-mono font-medium">
                        {secret.name}
                        {secret.description && (
                          <p className="text-[13px] text-muted-foreground font-sans">
                            {secret.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-[13px]">
                            {revealedSecrets.has(secret.id) 
                              ? secret.value 
                              : '•'.repeat(20)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRevealSecret(secret.id)}
                          >
                            {revealedSecrets.has(secret.id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          {secret.value && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(secret.value!, secret.name)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SECRET_CATEGORIES.find(c => c.id === secret.category)?.name || secret.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={secret.scope === 'global' ? 'default' : 'outline'}>
                          {secret.scope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">
                        {new Date(secret.lastUpdated).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {secret.usageCount} uses
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog 
                            open={editingSecret?.id === secret.id} 
                            onOpenChange={(open) => !open && setEditingSecret(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingSecret(secret)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Secret</DialogTitle>
                                <DialogDescription>
                                  Update the secret value or details
                                </DialogDescription>
                              </DialogHeader>
                              <SecretForm 
                                secret={editingSecret} 
                                onSubmit={(data) => updateSecretMutation.mutate({ 
                                  id: secret.id, 
                                  ...data 
                                })} 
                              />
                            </DialogContent>
                          </Dialog>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Secret</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{secret.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteSecretMutation.mutate(secret.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          
          {/* Security notice */}
          <div className="mt-6 p-4 bg-muted rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-[13px] text-muted-foreground">
              <p className="font-medium mb-1">Security Notice</p>
              <p>
                Secrets are encrypted at rest and in transit. They are only accessible to your project 
                during runtime and are never exposed in logs or version control.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}