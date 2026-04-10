import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Archive, Download, Upload, RefreshCw, Calendar,
  HardDrive, Clock, CheckCircle, AlertCircle, 
  Settings, Trash2, Plus, FileArchive
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Backup {
  id: string;
  name: string;
  description?: string;
  type: 'manual' | 'automatic' | 'scheduled';
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed' | 'corrupted';
  includes: {
    files: boolean;
    database: boolean;
    secrets: boolean;
    settings: boolean;
  };
  location: 'local' | 'cloud' | 'external';
}

interface BackupSettings {
  autoBackup: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  retention: number; // days
  includes: {
    files: boolean;
    database: boolean;
    secrets: boolean;
    settings: boolean;
  };
  cloudStorage: boolean;
  compressionLevel: 'none' | 'standard' | 'maximum';
}

interface ReplitBackupsProps {
  projectId: number;
}

export function ReplitBackups({ projectId }: ReplitBackupsProps) {
  const { toast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [settings, setSettings] = useState<BackupSettings>({
    autoBackup: false,
    frequency: 'daily',
    retention: 30,
    includes: { files: true, database: true, secrets: false, settings: true },
    cloudStorage: false,
    compressionLevel: 'standard'
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newBackup, setNewBackup] = useState({
    name: '',
    description: '',
    includes: { files: true, database: true, secrets: false, settings: true }
  });

  useEffect(() => {
    fetchBackups();
    fetchSettings();
  }, [projectId]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/backups/${projectId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast({
        title: "Error",
        description: "Failed to fetch backups",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/backups/${projectId}/settings`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching backup settings:', error);
    }
  };

  const createBackup = async () => {
    if (!newBackup.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Backup name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      setCreating(true);
      const response = await apiRequest('POST', `/api/backups/${projectId}`, {
        name: newBackup.name,
        description: newBackup.description,
        includes: newBackup.includes,
        type: 'manual'
      });

      if (response.ok) {
        toast({
          title: "Backup Created",
          description: `Backup "${newBackup.name}" is being created`
        });
        
        setNewBackup({
          name: '',
          description: '',
          includes: { files: true, database: true, secrets: false, settings: true }
        });
        setShowCreateDialog(false);
        fetchBackups();
      } else {
        const error = await response.json();
        toast({
          title: "Backup Failed",
          description: error.message || "Failed to create backup",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    try {
      setRestoring(backupId);
      const response = await apiRequest('POST', `/api/backups/${projectId}/${backupId}/restore`, {});

      if (response.ok) {
        toast({
          title: "Restore Started",
          description: "Project is being restored from backup"
        });
        
        // Poll for restore status
        const pollRestore = setInterval(async () => {
          const statusRes = await fetch(`/api/backups/${projectId}/${backupId}/restore-status`, {
            credentials: 'include'
          });
          
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.completed) {
              clearInterval(pollRestore);
              setRestoring(null);
              toast({
                title: "Restore Completed",
                description: "Project has been successfully restored"
              });
            }
          }
        }, 2000);
        
        // Stop polling after 10 minutes
        setTimeout(() => {
          clearInterval(pollRestore);
          setRestoring(null);
        }, 600000);
      }
    } catch (error) {
      setRestoring(null);
      toast({
        title: "Restore Failed",
        description: "Failed to restore from backup",
        variant: "destructive"
      });
    }
  };

  const downloadBackup = async (backupId: string, name: string) => {
    try {
      const response = await fetch(`/api/backups/${projectId}/${backupId}/download`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name}-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Download Started",
          description: "Backup download has begun"
        });
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download backup",
        variant: "destructive"
      });
    }
  };

  const deleteBackup = async (backupId: string) => {
    try {
      const response = await apiRequest('DELETE', `/api/backups/${projectId}/${backupId}`, {});

      if (response.ok) {
        toast({
          title: "Backup Deleted",
          description: "Backup has been removed"
        });
        fetchBackups();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete backup",
        variant: "destructive"
      });
    }
  };

  const updateSettings = async (newSettings: Partial<BackupSettings>) => {
    try {
      const response = await apiRequest('PUT', `/api/backups/${projectId}/settings`, { ...settings, ...newSettings });

      if (response.ok) {
        setSettings(prev => ({ ...prev, ...newSettings }));
        toast({
          title: "Settings Updated",
          description: "Backup settings have been saved"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 border-green-200';
      case 'in_progress': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed': return 'text-red-600 bg-red-50 border-red-200';
      case 'corrupted': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_progress': return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      case 'corrupted': return <AlertCircle className="h-4 w-4" />;
      default: return <Archive className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'automatic': return 'text-green-600 bg-green-50 border-green-200';
      case 'scheduled': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Archive className="h-6 w-6" />
            Project Backups
          </h2>
          <p className="text-muted-foreground">
            Create, manage, and restore project backups
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchBackups}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button disabled={creating}>
                {creating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Backup
                  </>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Backup</DialogTitle>
                <DialogDescription>
                  Create a complete backup of your project
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Backup Name</Label>
                    <Input
                      id="name"
                      placeholder="Production Backup"
                      value={newBackup.name}
                      onChange={(e) => setNewBackup(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="Before major update"
                      value={newBackup.description}
                      onChange={(e) => setNewBackup(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label>What to Include</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'files', label: 'Project Files', desc: 'All source code and assets' },
                      { key: 'database', label: 'Database', desc: 'All database content and structure' },
                      { key: 'secrets', label: 'Environment Secrets', desc: 'API keys and configuration' },
                      { key: 'settings', label: 'Project Settings', desc: 'Configuration and preferences' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={item.key}
                          checked={newBackup.includes[item.key as keyof typeof newBackup.includes]}
                          onChange={(e) => setNewBackup(prev => ({
                            ...prev,
                            includes: { ...prev.includes, [item.key]: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <div>
                          <label htmlFor={item.key} className="text-[13px] font-medium">
                            {item.label}
                          </label>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createBackup} disabled={creating}>
                    Create Backup
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Backup Settings
          </CardTitle>
          <CardDescription>
            Configure automatic backups and retention policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Automatic Backups</p>
                  <p className="text-[13px] text-muted-foreground">Enable scheduled backups</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoBackup}
                  onChange={(e) => updateSettings({ autoBackup: e.target.checked })}
                  className="rounded"
                />
              </div>
              
              {settings.autoBackup && (
                <>
                  <div>
                    <Label>Backup Frequency</Label>
                    <select
                      value={settings.frequency}
                      onChange={(e) => updateSettings({ frequency: e.target.value as any })}
                      className="w-full p-2 border rounded-md mt-1"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label>Retention Period (days)</Label>
                    <Input
                      type="number"
                      value={settings.retention}
                      onChange={(e) => updateSettings({ retention: parseInt(e.target.value) })}
                      min="1"
                      max="365"
                      className="mt-1"
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Cloud Storage</p>
                  <p className="text-[13px] text-muted-foreground">Store backups in the cloud</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cloudStorage}
                  onChange={(e) => updateSettings({ cloudStorage: e.target.checked })}
                  className="rounded"
                />
              </div>
              
              <div>
                <Label>Compression Level</Label>
                <select
                  value={settings.compressionLevel}
                  onChange={(e) => updateSettings({ compressionLevel: e.target.value as any })}
                  className="w-full p-2 border rounded-md mt-1"
                >
                  <option value="none">None (Fastest)</option>
                  <option value="standard">Standard</option>
                  <option value="maximum">Maximum (Smallest)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Backups ({backups.length})</CardTitle>
          <CardDescription>
            Manage your project backups and restore points
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              <span className="ml-2">Loading backups...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8">
              <FileArchive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold mb-2">No backups found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first backup to protect your project
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Backup
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <Card key={backup.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Archive className="h-4 w-4" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{backup.name}</span>
                          <Badge className={`${getStatusColor(backup.status)} border text-[11px]`}>
                            {getStatusIcon(backup.status)}
                            <span className="ml-1 capitalize">{backup.status.replace('_', ' ')}</span>
                          </Badge>
                          <Badge className={`${getTypeColor(backup.type)} border text-[11px]`}>
                            {backup.type}
                          </Badge>
                        </div>
                        
                        {backup.description && (
                          <p className="text-[13px] text-muted-foreground mb-1">
                            {backup.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <HardDrive className="h-3 w-3" />
                            {formatBytes(backup.size)}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(backup.createdAt).toLocaleDateString()}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(backup.createdAt).toLocaleTimeString()}
                          </div>
                          
                          <span>{backup.location}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2">
                          {Object.entries(backup.includes).map(([key, included]) => 
                            included && (
                              <Badge key={key} variant="outline" className="text-[11px]">
                                {key}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadBackup(backup.id, backup.name)}
                        disabled={backup.status !== 'completed'}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        onClick={() => restoreBackup(backup.id)}
                        disabled={backup.status !== 'completed' || restoring === backup.id}
                      >
                        {restoring === backup.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            Restoring
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteBackup(backup.id)}
                        disabled={backup.status === 'in_progress'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {backup.status === 'in_progress' && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[13px] mb-1">
                        <span>Creating backup...</span>
                        <span>45%</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}