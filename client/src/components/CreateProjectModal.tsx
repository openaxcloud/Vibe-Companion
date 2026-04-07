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
      if (initialDescription.includes("web app")) {
        projectName = "Web App";
      } else if (initialDescription.includes("Flask")) {
        projectName = "Flask API";
      } else if (initialDescription.includes("React")) {
        projectName = "React Project";
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
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Give your project a name to get started or describe what you want to build.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-right">
                Project Name
              </Label>
              <Input
                id="name"
                placeholder="My awesome project"
                {...form.register("name")}
                className="col-span-3"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-right">
                Description (optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Describe what you want to build..."
                {...form.register("description")}
                className="min-h-[80px] resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="template" className="text-right">
                Template
              </Label>
              <Select defaultValue="blank" {...form.register("template")}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank Project</SelectItem>
                  <SelectItem value="html">HTML/CSS/JS</SelectItem>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="express">Express.js</SelectItem>
                  <SelectItem value="flask">Flask</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setAiGenerated(!aiGenerated)}
            >
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Generate with AI
            </Button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};