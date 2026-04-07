import { useState } from "react";
import { useEnvironment, EnvironmentVariable } from "@/hooks/useEnvironment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Eye, EyeOff, HelpCircle, KeyRound, MoreVertical, Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EnvironmentPanelProps {
  projectId: number;
}

export default function EnvironmentPanel({ projectId }: EnvironmentPanelProps) {
  const {
    variables,
    isLoading,
    createVariableMutation,
    updateVariableMutation,
    deleteVariableMutation,
  } = useEnvironment();

  const [newVariable, setNewVariable] = useState({
    key: "",
    value: "",
    isSecret: false,
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<EnvironmentVariable | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<"dev" | "prod">("dev");
  const [search, setSearch] = useState("");

  const handleCreateVariable = () => {
    createVariableMutation.mutate(
      {
        projectId,
        variable: newVariable,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setNewVariable({ key: "", value: "", isSecret: false });
        },
      }
    );
  };

  const handleDeleteVariable = () => {
    if (selectedVariable) {
      deleteVariableMutation.mutate(
        {
          id: selectedVariable.id,
          projectId,
        },
        {
          onSuccess: () => {
            setDeleteDialogOpen(false);
            setSelectedVariable(null);
          },
        }
      );
    }
  };

  const toggleShowSecret = (id: number) => {
    setShowSecrets(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredVariables = variables.filter(v => 
    v.key.toLowerCase().includes(search.toLowerCase()) ||
    v.value.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Section - Styled exactly like Replit */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Environment Variables</h2>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-sm">
                <p>Environment variables contain data that your Repl can access at runtime. They are commonly used to store configuration and secrets.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 px-3 gap-2 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Add variable
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Environment Variable</DialogTitle>
              <DialogDescription>
                Environment variables are available to your project at runtime.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key</Label>
                <Input
                  id="key"
                  placeholder="DATABASE_URL"
                  className="font-mono"
                  value={newVariable.key}
                  onChange={(e) =>
                    setNewVariable({ ...newVariable, key: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  placeholder="postgres://username:password@host:port/database"
                  className="font-mono"
                  value={newVariable.value}
                  onChange={(e) =>
                    setNewVariable({ ...newVariable, value: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="secret"
                  checked={newVariable.isSecret}
                  onCheckedChange={(checked) =>
                    setNewVariable({ ...newVariable, isSecret: checked })
                  }
                />
                <Label htmlFor="secret">Secret variable (hide value)</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateVariable}
                disabled={!newVariable.key || createVariableMutation.isPending}
              >
                {createVariableMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Variable
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Main Content - Exactly like Replit */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center p-3 gap-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "dev" | "prod")} className="w-full">
            <TabsList className="w-full p-0 h-9 bg-background border rounded-md">
              <TabsTrigger value="dev" className="flex-1 h-full rounded-sm data-[state=active]:bg-muted/50">
                Development
              </TabsTrigger>
              <TabsTrigger value="prod" className="flex-1 h-full rounded-sm data-[state=active]:bg-muted/50">
                Production
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Input
              placeholder="Filter variables"
              className="h-9 w-full max-w-[200px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <TabsContent value="dev" className="flex-1 overflow-hidden m-0 p-0">
          <ScrollArea className="h-full px-3 pb-3">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredVariables.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <KeyRound className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1">No environment variables</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Environment variables can be used to store configuration data and secrets for your repl.
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add your first variable
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* User Variables Section */}
                <div>
                  <div className="py-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Your variables</h3>
                  </div>
                  <div className="bg-background border rounded-md overflow-hidden">
                    {filteredVariables.map((variable, index) => (
                      <div key={variable.id}>
                        {index > 0 && <Separator />}
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium truncate">{variable.key}</span>
                              {variable.isSecret && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">Secret</span>
                              )}
                            </div>
                            <div className="flex items-center mt-1 text-sm font-mono text-muted-foreground">
                              {variable.isSecret ? (
                                showSecrets[variable.id] ? (
                                  variable.value
                                ) : (
                                  "••••••••••••••••"
                                )
                              ) : (
                                variable.value
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {variable.isSecret && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full"
                                onClick={() => toggleShowSecret(variable.id)}
                              >
                                {showSecrets[variable.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => copyToClipboard(variable.value)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <AlertDialog open={deleteDialogOpen && selectedVariable?.id === variable.id} onOpenChange={setDeleteDialogOpen}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      setSelectedVariable(variable);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Environment Variable
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the environment variable{" "}
                                    <span className="font-mono font-bold">
                                      {selectedVariable?.key}
                                    </span>
                                    ? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={handleDeleteVariable}
                                  >
                                    {deleteVariableMutation.isPending && (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* System Secrets Section */}
                <div>
                  <div className="py-2">
                    <h3 className="text-sm font-medium text-muted-foreground">System secrets</h3>
                  </div>
                  <div className="bg-background border rounded-md overflow-hidden">
                    {["DATABASE_URL", "PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGPORT"].map((key, index) => (
                      <div key={key}>
                        {index > 0 && <Separator />}
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium truncate">{key}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">System</span>
                            </div>
                            <div className="flex items-center mt-1 text-sm font-mono text-muted-foreground">
                              ••••••••••••••••
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => {}}
                              disabled
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon" 
                              className="h-8 w-8 rounded-full"
                              onClick={() => {}}
                              disabled
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="prod" className="flex-1 overflow-hidden m-0 p-0">
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <KeyRound className="h-10 w-10 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Production Environment</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Production environment variables are used when deploying your application.
              They are separate from development variables and can be configured for each deployment.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              disabled
            >
              <Plus className="h-4 w-4" />
              Configure Production Variables
            </Button>
          </div>
        </TabsContent>
      </div>
    </div>
  );
}