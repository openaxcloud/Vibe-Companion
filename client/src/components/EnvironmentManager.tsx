import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/alert-dialog";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { 
  KeyRound, 
  Plus, 
  Eye, 
  EyeOff, 
  Copy, 
  Trash2, 
  Save, 
  Info, 
  Settings2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@shared/schema";

interface EnvVariable {
  id: number;
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvironmentManagerProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

const formSchema = z.object({
  key: z.string().min(1, "Key is required").max(255),
  value: z.string().max(5000),
  isSecret: z.boolean().default(false),
});

export function EnvironmentManager({ project, isOpen, onClose }: EnvironmentManagerProps) {
  const [variables, setVariables] = useState<EnvVariable[]>([
    { id: 1, key: "PORT", value: "3000", isSecret: false },
    { id: 2, key: "NODE_ENV", value: "development", isSecret: false },
    { id: 3, key: "API_KEY", value: "sk_test_123456789", isSecret: true },
    { id: 4, key: "DATABASE_URL", value: "postgres://user:password@localhost:5432/db", isSecret: true },
  ]);
  
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [variableToDelete, setVariableToDelete] = useState<number | null>(null);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      key: "",
      value: "",
      isSecret: false,
    },
  });
  
  const toggleShowSecret = (id: number) => {
    setShowSecrets(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  const handleCopyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: "Copied to clipboard",
      description: "The value has been copied to your clipboard.",
    });
  };
  
  const confirmDelete = (id: number) => {
    setVariableToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleDelete = () => {
    if (variableToDelete !== null) {
      setVariables(variables.filter(v => v.id !== variableToDelete));
      toast({
        title: "Variable deleted",
        description: "The environment variable has been deleted.",
      });
      setDeleteDialogOpen(false);
      setVariableToDelete(null);
    }
  };
  
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Check if key already exists
    if (variables.some(v => v.key === values.key)) {
      toast({
        title: "Duplicate key",
        description: "An environment variable with this key already exists.",
        variant: "destructive",
      });
      return;
    }
    
    // Add new variable
    const newVariable: EnvVariable = {
      id: variables.length > 0 ? Math.max(...variables.map(v => v.id)) + 1 : 1,
      key: values.key,
      value: values.value,
      isSecret: values.isSecret,
    };
    
    setVariables([...variables, newVariable]);
    
    toast({
      title: "Variable added",
      description: "The environment variable has been added.",
    });
    
    // Reset form
    form.reset();
  };
  
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Environment Variables
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>Manage environment variables for your project.</span>
              <Button variant="ghost" size="sm" onClick={() => setInfoSheetOpen(true)}>
                <Info className="h-4 w-4 mr-1" /> Guide
              </Button>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-4">
                      <FormLabel>Key</FormLabel>
                      <FormControl>
                        <Input placeholder="DATABASE_URL" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-6">
                      <FormLabel>Value</FormLabel>
                      <FormControl>
                        <Input placeholder="postgres://user:pass@localhost:5432/db" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex sm:col-span-2 gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="isSecret"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-start space-x-2 flex-1 pb-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">Secret</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <Button type="submit" className="ml-auto">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Form>
            
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Key</TableHead>
                    <TableHead className="whitespace-nowrap">Value</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variables.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        No environment variables yet. Add one above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    variables.map((variable) => (
                      <TableRow key={variable.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="break-all">{variable.key}</span>
                            {variable.isSecret && (
                              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded whitespace-nowrap">
                                Secret
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[150px] sm:max-w-[200px] md:max-w-full overflow-hidden text-ellipsis">
                            {variable.isSecret ? (
                              showSecrets[variable.id] ? (
                                <span className="font-mono text-sm break-all">{variable.value}</span>
                              ) : (
                                "••••••••••••••••••"
                              )
                            ) : (
                              <span className="font-mono text-sm break-all">{variable.value}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {variable.isSecret && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleShowSecret(variable.id)}
                                className="h-8 w-8"
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
                              onClick={() => handleCopyValue(variable.value)}
                              className="h-8 w-8"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDelete(variable.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-muted p-4 rounded-md text-sm space-y-2">
              <h4 className="font-medium flex items-center">
                <Settings2 className="h-4 w-4 mr-2" /> Environment variables take effect on next deployment
              </h4>
              <p className="text-muted-foreground">
                Changes to environment variables will be applied when you redeploy your application.
                Secret variables are never exposed to the browser.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this environment variable.
              Applications that rely on this variable might stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Sheet open={infoSheetOpen} onOpenChange={setInfoSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Environment Variables Guide</SheetTitle>
            <SheetDescription>
              Learn how to use environment variables in your project.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6 mt-6">
            <div>
              <h3 className="text-lg font-medium">What are environment variables?</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Environment variables are a set of key-value pairs that can be accessed by your application.
                They're typically used to store configuration values like API keys, database credentials, and other settings.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium">Security</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Mark sensitive information like API keys and passwords as "Secret". Secret variables are:
              </p>
              <ul className="list-disc ml-6 mt-2 text-muted-foreground text-sm">
                <li>Never displayed in logs</li>
                <li>Not exposed to the browser</li>
                <li>Hidden from other users</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-medium">Accessing Variables</h3>
              <div className="bg-muted p-3 rounded-md mt-2 font-mono text-xs sm:text-sm overflow-x-auto">
                <p className="py-1">// Node.js</p>
                <p className="py-1">const apiKey = process.env.API_KEY;</p>
                <div className="border-t my-2"></div>
                <p className="py-1">// Browser (only non-secret vars)</p>
                <p className="py-1">const port = import.meta.env.VITE_PORT;</p>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}