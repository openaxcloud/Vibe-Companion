import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExternalLink, Info, AlertTriangle, Save, RotateCw, Package } from 'lucide-react';

interface NixConfigProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NixConfig({ projectId, open, onOpenChange }: NixConfigProps) {
  const [config, setConfig] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  // Default Nix template
  const defaultNixTemplate = `{ pkgs }: {
  deps = [
    pkgs.nodePackages.typescript
    pkgs.yarn
    pkgs.replitPackages.jest
  ];
}`;
  
  // Fetch Nix config for the project
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/projects', projectId, 'nix'],
    enabled: open && projectId > 0,
    onSuccess: (data) => {
      setConfig(data?.config || defaultNixTemplate);
    },
    onError: () => {
      setConfig(defaultNixTemplate);
    }
  });
  
  // Update Nix config mutation
  const updateMutation = useMutation({
    mutationFn: async (config: string) => {
      const response = await fetch(`/api/projects/${projectId}/nix`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update Nix configuration');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Nix configuration updated',
        description: 'Your Nix configuration has been updated successfully.',
      });
      setIsEditing(false);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error updating Nix configuration',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Reset config when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);
  
  const handleSubmit = () => {
    updateMutation.mutate(config);
  };
  
  const handleReset = () => {
    setConfig(data?.config || defaultNixTemplate);
    setIsEditing(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Nix Configuration
          </DialogTitle>
          <DialogDescription>
            Customize your development environment using Nix. This configuration controls packages available in your environment.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert variant="default" className="bg-muted">
            <Info className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                The Nix configuration is used to specify the packages available in your development environment.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Add packages from the nixpkgs repository</li>
                <li>PLOT will build your environment automatically</li>
                <li>Changes require a container rebuild</li>
              </ul>
              <a 
                href="https://nixos.org/manual/nix/stable/introduction.html" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center text-sm mt-2 text-primary hover:underline"
              >
                Learn more about Nix <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </AlertDescription>
          </Alert>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <RotateCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Configuration</h3>
                <div className="space-x-2">
                  {isEditing && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleReset}
                    >
                      Reset
                    </Button>
                  )}
                  <Button 
                    variant={isEditing ? "default" : "outline"} 
                    size="sm"
                    onClick={() => {
                      if (isEditing) {
                        handleSubmit();
                      } else {
                        setIsEditing(true);
                      }
                    }}
                    disabled={updateMutation.isPending}
                  >
                    {isEditing ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      'Edit Configuration'
                    )}
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-[300px] border rounded-md bg-muted/50">
                <Textarea
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  className="font-mono text-sm border-0 min-h-[300px] bg-transparent"
                  disabled={!isEditing}
                  placeholder="Enter your Nix configuration here..."
                />
              </ScrollArea>
              
              {isEditing && (
                <Alert variant="warning">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    Changes to the Nix configuration will rebuild your environment, which may take some time. Your current sessions will be terminated.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}