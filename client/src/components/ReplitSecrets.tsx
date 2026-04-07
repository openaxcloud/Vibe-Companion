import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Key, Plus, Eye, EyeOff, Copy, Check, 
  Shield, AlertTriangle, Trash2, Edit
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Secret {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: 'api' | 'database' | 'auth' | 'service' | 'other';
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ReplitSecretsProps {
  projectId: number;
}

export function ReplitSecrets({ projectId }: ReplitSecretsProps) {
  const { toast } = useToast();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSecret, setNewSecret] = useState({
    key: '',
    value: '',
    description: '',
    category: 'other' as const
  });
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchSecrets();
  }, [projectId]);

  const fetchSecrets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/secrets/${projectId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSecrets(data.secrets || []);
      }
    } catch (error) {
      console.error('Error fetching secrets:', error);
      toast({
        title: "Error",
        description: "Failed to fetch secrets",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addSecret = async () => {
    if (!newSecret.key.trim() || !newSecret.value.trim()) {
      toast({
        title: "Validation Error",
        description: "Key and value are required",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await apiRequest('POST', `/api/secrets/${projectId}`, newSecret);

      if (response.ok) {
        toast({
          title: "Secret Added",
          description: `Secret ${newSecret.key} has been added`
        });
        
        setNewSecret({ key: '', value: '', description: '', category: 'other' });
        setShowAddDialog(false);
        fetchSecrets();
      } else {
        const error = await response.json();
        toast({
          title: "Failed to Add Secret",
          description: error.message || "An error occurred",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add secret",
        variant: "destructive"
      });
    }
  };

  const deleteSecret = async (secretId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/secrets/${projectId}/${secretId}`, {});

      if (response.ok) {
        toast({
          title: "Secret Deleted",
          description: "Secret has been removed"
        });
        fetchSecrets();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete secret",
        variant: "destructive"
      });
    }
  };

  const toggleVisibility = (secretId: string) => {
    setSecrets(prev => prev.map(secret => 
      secret.id === secretId 
        ? { ...secret, isVisible: !secret.isVisible }
        : secret
    ));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({
      title: "Copied",
      description: "Secret value copied to clipboard"
    });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'api': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'database': return 'text-green-600 bg-green-50 border-green-200';
      case 'auth': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'service': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'api': return '🔌';
      case 'database': return '🗄️';
      case 'auth': return '🔐';
      case 'service': return '⚙️';
      default: return '🔑';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Environment Secrets
          </h2>
          <p className="text-muted-foreground">
            Securely store API keys, passwords, and other sensitive data
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Secret
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Secret</DialogTitle>
              <DialogDescription>
                Add a new environment secret to your project. Secrets are encrypted and only accessible during runtime.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    placeholder="SECRET_KEY"
                    value={newSecret.key}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={newSecret.category}
                    onChange={(e) => setNewSecret(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="api">API Key</option>
                    <option value="database">Database</option>
                    <option value="auth">Authentication</option>
                    <option value="service">Service</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Textarea
                  id="value"
                  placeholder="Enter secret value..."
                  value={newSecret.value}
                  onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="What is this secret used for?"
                  value={newSecret.description}
                  onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={addSecret}>
                  Add Secret
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Security Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">Security Best Practices</h3>
              <ul className="text-[13px] text-yellow-700 mt-1 space-y-1">
                <li>• Never store secrets in your code or commit them to version control</li>
                <li>• Use strong, unique values for all secrets</li>
                <li>• Regularly rotate your API keys and passwords</li>
                <li>• Only share secrets with trusted team members</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secrets List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Secrets ({secrets.length})</CardTitle>
          <CardDescription>
            Manage environment variables and sensitive configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2">Loading secrets...</span>
            </div>
          ) : secrets.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold mb-2">No secrets configured</h3>
              <p className="text-muted-foreground mb-4">
                Add your first secret to securely store sensitive data
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Secret
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((secret) => (
                <Card key={secret.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-[15px]">
                        {getCategoryIcon(secret.category)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-medium">{secret.key}</span>
                          <Badge className={`${getCategoryColor(secret.category)} border text-[11px]`}>
                            {secret.category}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[13px] bg-muted px-2 py-1 rounded flex-1 max-w-md">
                            {secret.isVisible 
                              ? secret.value 
                              : '•'.repeat(Math.min(secret.value.length, 20))
                            }
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleVisibility(secret.id)}
                          >
                            {secret.isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(secret.value, secret.key)}
                          >
                            {copiedKey === secret.key ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        
                        {secret.description && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {secret.description}
                          </p>
                        )}
                        
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Created {new Date(secret.createdAt).toLocaleDateString()}
                          {secret.updatedAt !== secret.createdAt && (
                            <span> • Updated {new Date(secret.updatedAt).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => deleteSecret(secret.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Using Secrets in Your Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Environment Variables</h4>
            <div className="bg-muted p-3 rounded-lg font-mono text-[13px]">
              <div>// Node.js</div>
              <div>const apiKey = process.env.API_KEY;</div>
              <div className="mt-2"># Python</div>
              <div>import os</div>
              <div>api_key = os.environ.get('API_KEY')</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Best Practices</h4>
            <ul className="text-[13px] text-muted-foreground space-y-1">
              <li>• Use descriptive names like `DATABASE_URL` instead of `DB`</li>
              <li>• Always check if environment variables exist before using them</li>
              <li>• Use different secrets for development, staging, and production</li>
              <li>• Never log secret values or include them in error messages</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}