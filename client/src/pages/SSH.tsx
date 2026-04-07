import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Terminal, 
  Key, 
  Copy, 
  Plus, 
  Trash2, 
  Shield,
  AlertCircle,
  CheckCircle2,
  Info,
  Download,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Fingerprint,
  Lock,
  Unlock,
  Clock,
  User
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { ECodeLoading } from "@/components/ECodeLoading";

interface SSHKey {
  id: string;
  name: string;
  fingerprint: string;
  publicKey: string;
  type: 'rsa' | 'ed25519' | 'ecdsa';
  addedAt: string;
  lastUsed?: string;
  comment?: string;
}

interface SSHSession {
  id: string;
  host: string;
  user: string;
  status: 'active' | 'inactive';
  connectedAt: string;
  lastActivity: string;
  keyId: string;
  keyName: string;
}

export default function SSH() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("keys");
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false);
  const [generateKeyDialogOpen, setGenerateKeyDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SSHKey | null>(null);

  // Form state for new key
  const [newKey, setNewKey] = useState({
    name: '',
    publicKey: '',
    comment: ''
  });

  // Form state for key generation
  const [keyGeneration, setKeyGeneration] = useState({
    name: '',
    type: 'ed25519' as const,
    comment: ''
  });

  // Fetch SSH keys
  const { data: sshKeys = [], isLoading: keysLoading } = useQuery<SSHKey[]>({
    queryKey: ['/api/ssh/keys'],
  });

  // Fetch SSH sessions
  const { data: sshSessions = [], isLoading: sessionsLoading } = useQuery<SSHSession[]>({
    queryKey: ['/api/ssh/sessions'],
  });

  // Add SSH key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (key: typeof newKey) => {
      const res = await apiRequest('POST', '/api/ssh/keys', key);
      if (!res.ok) throw new Error('Failed to add SSH key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ssh/keys'] });
      setAddKeyDialogOpen(false);
      toast({
        title: "SSH key added",
        description: "Your SSH key has been added successfully",
      });
      setNewKey({ name: '', publicKey: '', comment: '' });
    }
  });

  // Generate SSH key mutation
  const generateKeyMutation = useMutation({
    mutationFn: async (params: typeof keyGeneration) => {
      const res = await apiRequest('POST', '/api/ssh/keys/generate', params);
      if (!res.ok) throw new Error('Failed to generate SSH key');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ssh/keys'] });
      setGenerateKeyDialogOpen(false);
      toast({
        title: "SSH key generated",
        description: "Your new SSH key has been generated. Don't forget to download the private key!",
      });
      // Show the generated key details
      setSelectedKey(data);
      setShowPrivateKey(true);
    }
  });

  // Delete SSH key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await apiRequest('DELETE', `/api/ssh/keys/${keyId}`);
      if (!res.ok) throw new Error('Failed to delete SSH key');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ssh/keys'] });
      toast({
        title: "SSH key deleted",
        description: "The SSH key has been removed",
      });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "The text has been copied to your clipboard",
    });
  };

  if (keysLoading || sessionsLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="relative h-full min-h-[calc(100vh-200px)]">
          <div className="absolute inset-0 flex items-center justify-center">
            <ECodeLoading size="lg" text="Loading SSH configuration..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl" data-testid="ssh-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-ssh-title">SSH Access</h1>
        <p className="text-muted-foreground">
          Manage SSH keys and active sessions for secure remote access
        </p>
      </div>

      {/* SSH Configuration Info */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>SSH Connection Details</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <div className="font-mono text-[13px]">
            <p>Host: <span className="text-primary">ssh.ecode.app</span></p>
            <p>Port: <span className="text-primary">22</span></p>
            <p>Username: <span className="text-primary">{`<your-username>`}</span></p>
          </div>
          <div className="mt-3">
            <p className="text-[13px]">Connect using:</p>
            <code className="block mt-1 p-2 bg-muted rounded text-[11px]">
              ssh -i ~/.ssh/your_key username@ssh.ecode.app
            </code>
          </div>
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="ssh-tabs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="keys" data-testid="tab-ssh-keys">SSH Keys</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-ssh-sessions">Active Sessions</TabsTrigger>
        </TabsList>

        {/* SSH Keys Tab */}
        <TabsContent value="keys" className="space-y-4" data-testid="content-ssh-keys">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Your SSH Keys</h2>
            <div className="space-x-2">
              <Dialog open={addKeyDialogOpen} onOpenChange={setAddKeyDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-existing-key">
                    <Upload className="mr-2 h-4 w-4" />
                    Add Existing Key
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-ssh-key">
                  <DialogHeader>
                    <DialogTitle>Add SSH Key</DialogTitle>
                    <DialogDescription>
                      Add an existing SSH public key to your account
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="key-name">Key Name</Label>
                      <Input
                        id="key-name"
                        value={newKey.name}
                        onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                        placeholder="MacBook Pro"
                        data-testid="input-ssh-key-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="public-key">Public Key</Label>
                      <textarea
                        id="public-key"
                        className="w-full min-h-[100px] p-3 rounded-md border bg-background font-mono text-[13px]"
                        value={newKey.publicKey}
                        onChange={(e) => setNewKey({ ...newKey, publicKey: e.target.value })}
                        placeholder="ssh-rsa AAAAB3NzaC1yc2..."
                        data-testid="input-ssh-public-key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="comment">Comment (optional)</Label>
                      <Input
                        id="comment"
                        value={newKey.comment}
                        onChange={(e) => setNewKey({ ...newKey, comment: e.target.value })}
                        placeholder="Personal laptop"
                        data-testid="input-ssh-comment"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddKeyDialogOpen(false)} data-testid="button-cancel-add-key">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => addKeyMutation.mutate(newKey)}
                      disabled={!newKey.name || !newKey.publicKey || addKeyMutation.isPending}
                      data-testid="button-confirm-add-key"
                    >
                      Add Key
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={generateKeyDialogOpen} onOpenChange={setGenerateKeyDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-generate-new-key">
                    <Plus className="mr-2 h-4 w-4" />
                    Generate New Key
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-generate-ssh-key">
                  <DialogHeader>
                    <DialogTitle>Generate SSH Key</DialogTitle>
                    <DialogDescription>
                      Generate a new SSH key pair
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="gen-key-name">Key Name</Label>
                      <Input
                        id="gen-key-name"
                        value={keyGeneration.name}
                        onChange={(e) => setKeyGeneration({ ...keyGeneration, name: e.target.value })}
                        placeholder="Development Key"
                        data-testid="input-gen-key-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="key-type">Key Type</Label>
                      <select
                        id="key-type"
                        className="w-full p-2 rounded-md border bg-background"
                        value={keyGeneration.type}
                        onChange={(e) => setKeyGeneration({ ...keyGeneration, type: e.target.value as any })}
                        data-testid="select-key-type"
                      >
                        <option value="ed25519">ED25519 (Recommended)</option>
                        <option value="rsa">RSA 4096</option>
                        <option value="ecdsa">ECDSA</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gen-comment">Comment (optional)</Label>
                      <Input
                        id="gen-comment"
                        value={keyGeneration.comment}
                        onChange={(e) => setKeyGeneration({ ...keyGeneration, comment: e.target.value })}
                        placeholder="user@hostname"
                        data-testid="input-gen-comment"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setGenerateKeyDialogOpen(false)} data-testid="button-cancel-generate">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => generateKeyMutation.mutate(keyGeneration)}
                      disabled={!keyGeneration.name || generateKeyMutation.isPending}
                      data-testid="button-confirm-generate"
                    >
                      Generate Key
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* SSH Keys List */}
          <div className="grid gap-4">
            {sshKeys.map((key) => (
              <Card key={key.id} data-testid={`ssh-key-card-${key.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-[15px] flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        <span data-testid={`ssh-key-name-${key.id}`}>{key.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {key.comment || 'No description'}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteKeyMutation.mutate(key.id)}
                      disabled={deleteKeyMutation.isPending}
                      data-testid={`button-delete-ssh-key-${key.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <Badge variant="secondary" className="mt-1">
                        {key.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Added</p>
                      <p className="font-medium">{key.addedAt}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[13px] text-muted-foreground">Fingerprint</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-muted p-2 rounded flex-1 overflow-x-auto">
                        {key.fingerprint}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.fingerprint)}
                        data-testid={`button-copy-fingerprint-${key.id}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[13px] text-muted-foreground">Public Key</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-muted p-2 rounded flex-1 truncate">
                        {key.publicKey}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(key.publicKey)}
                        data-testid={`button-copy-pubkey-${key.id}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {key.lastUsed && (
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last used {key.lastUsed}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {sshKeys.length === 0 && (
              <Card data-testid="empty-ssh-keys">
                <CardContent className="text-center py-12">
                  <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">No SSH keys yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add an SSH key to enable secure remote access
                  </p>
                  <Button onClick={() => setGenerateKeyDialogOpen(true)} data-testid="button-generate-first-key">
                    <Plus className="mr-2 h-4 w-4" />
                    Generate New Key
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Active Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4" data-testid="content-ssh-sessions">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Active SSH Sessions</h2>
            <Button variant="outline" size="sm" data-testid="button-refresh-sessions">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          <div className="grid gap-4">
            {sshSessions.map((session) => (
              <Card key={session.id} data-testid={`ssh-session-card-${session.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-[15px] flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        <span data-testid={`session-host-${session.id}`}>{session.host}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Connected as <span className="font-medium">{session.user}</span>
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={session.status === 'active' ? 'default' : 'secondary'}
                      className="flex items-center gap-1"
                      data-testid={`session-status-${session.id}`}
                    >
                      {session.status === 'active' ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {session.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-[13px]">
                    <div>
                      <p className="text-muted-foreground">Connected</p>
                      <p className="font-medium">{session.connectedAt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Activity</p>
                      <p className="font-medium">{session.lastActivity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">SSH Key</p>
                      <p className="font-medium">{session.keyName}</p>
                    </div>
                  </div>
                  
                  {session.status === 'active' && (
                    <div className="mt-4">
                      <Button variant="outline" size="sm" className="w-full" data-testid={`button-open-terminal-${session.id}`}>
                        <Terminal className="mr-2 h-4 w-4" />
                        Open Terminal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {sshSessions.length === 0 && (
              <Card data-testid="empty-ssh-sessions">
                <CardContent className="text-center py-12">
                  <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-[15px] font-semibold mb-2">No active sessions</h3>
                  <p className="text-muted-foreground">
                    SSH sessions will appear here when you connect
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}