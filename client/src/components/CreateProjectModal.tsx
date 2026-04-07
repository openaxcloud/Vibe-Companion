import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isLoading: boolean;
  initialDescription?: string;
}

const formSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name must be less than 50 characters"),
  description: z.string().optional(),
  template: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const CreateProjectModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  initialDescription = ""
}: CreateProjectModalProps) => {
  const [aiGenerated, setAiGenerated] = useState(false);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: initialDescription,
      template: "blank",
    },
  });
  
  // Update form values when initialDescription changes
  useEffect(() => {
    if (initialDescription) {
      // Extract a name from the description
      let projectName = "";
      if (initialDescription.includes("web app") || initialDescription.includes("website")) {
        projectName = "My Website";
      } else if (initialDescription.includes("game")) {
        projectName = "Fun Game";
      } else if (initialDescription.includes("app")) {
        projectName = "My App";
      } else {
        // Use the first 3-4 words as the name
        const words = initialDescription.split(" ").slice(0, 4);
        projectName = words.join(" ");
        // Capitalize first letter
        projectName = projectName.charAt(0).toUpperCase() + projectName.slice(1);
      }
      
      form.setValue("name", projectName);
      form.setValue("description", initialDescription);
    }
  }, [initialDescription, form]);

  const handleSubmit = (values: FormValues) => {
    onSubmit(values.name);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle className="text-2xl text-[var(--ecode-text)]">Create a Repl</DialogTitle>
            <DialogDescription className="text-[var(--ecode-muted)]">
              A Repl is an interactive programming environment
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[var(--ecode-text)]">
                Title
              </Label>
              <Input
                id="name"
                placeholder="My Repl"
                {...form.register("name")}
                className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)] placeholder:text-[var(--ecode-muted)]"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template" className="text-[var(--ecode-text)]">
                Template
              </Label>
              <Select defaultValue="blank" {...form.register("template")}>
                <SelectTrigger 
                  id="template"
                  className="bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)]"
                >
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
                  <SelectItem value="blank" className="text-[var(--ecode-text)]">Blank Repl</SelectItem>
                  <SelectItem value="python" className="text-[var(--ecode-text)]">Python</SelectItem>
                  <SelectItem value="nodejs" className="text-[var(--ecode-text)]">Node.js</SelectItem>
                  <SelectItem value="html" className="text-[var(--ecode-text)]">HTML/CSS/JS</SelectItem>
                  <SelectItem value="react" className="text-[var(--ecode-text)]">React</SelectItem>
                  <SelectItem value="typescript" className="text-[var(--ecode-text)]">TypeScript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[var(--ecode-text)]">
                Description (optional)
              </Label>
              <Textarea
                id="description"
                placeholder="What will your Repl do?"
                {...form.register("description")}
                className="min-h-[80px] resize-none bg-[var(--ecode-sidebar)] border-[var(--ecode-border)] text-[var(--ecode-text)] placeholder:text-[var(--ecode-muted)]"
              />
            </div>
            
            {aiGenerated && (
              <div className="flex items-center gap-2 p-3 bg-[var(--ecode-accent)]/10 text-[var(--ecode-accent)] rounded-md">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">AI generated from your description</span>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={onClose} 
              type="button"
              className="border-[var(--ecode-border)] text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar)]"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-[var(--ecode-accent)] hover:bg-[var(--ecode-accent-hover)] text-white"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Repl
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};