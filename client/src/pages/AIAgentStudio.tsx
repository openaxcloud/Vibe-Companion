import { useEffect, useMemo, useState } from "react";
import {
  Badge,
} from "@/components/ui/badge";
import {
  Button,
} from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileCode2,
  Layers,
  Loader2,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedFile {
  id: string;
  fileName: string;
  content: string;
  language: string;
  description?: string;
  dependencies?: string[];
}

interface PreviewResponse {
  id: string;
  description: string;
  files: GeneratedFile[];
  preview: string;
  estimatedTime: number;
  complexity: string;
  technologies: string[];
  features: string[];
  deployment: {
    ready: boolean;
    instructions: string[];
  };
  metrics: {
    filesGenerated: number;
    totalLinesOfCode: number;
    estimatedTokens: number;
  };
}

const languages = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "ruby", label: "Ruby" },
  { value: "php", label: "PHP" },
  { value: "java", label: "Java" },
];

const steps = [
  {
    title: "Understand your vision",
    description: "Classifies the project and plans an optimal architecture",
  },
  {
    title: "Design project structure",
    description: "Builds file trees, selects dependencies, and prepares environment",
  },
  {
    title: "Generate production code",
    description: "Writes typed components, styles, and backend endpoints",
  },
  {
    title: "Assemble live preview",
    description: "Bundles assets and prepares a deployable sandbox preview",
  },
];

export default function AIAgentStudio() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("Build a modern SaaS dashboard with billing, analytics, and authentication");
  const [language, setLanguage] = useState("typescript");
  const [projectId, setProjectId] = useState("");
  const [result, setResult] = useState<PreviewResponse | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [copiedFileId, setCopiedFileId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const generatePreviewMutation = useMutation({
    mutationFn: async () => {
      const trimmedPrompt = prompt.trim();
      if (!trimmedPrompt) {
        throw new Error("Please describe the product you want the agent to build.");
      }

      const projectIdValue = projectId.trim();
      let parsedProjectId: number | undefined;
      if (projectIdValue) {
        parsedProjectId = Number(projectIdValue);
        if (Number.isNaN(parsedProjectId)) {
          throw new Error("Project ID must be a number.");
        }
      }

      const data = await apiRequest('POST', '/api/ai/generate-preview', {
        prompt: trimmedPrompt,
        language,
        projectId: parsedProjectId,
      }) as unknown as PreviewResponse;
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setSelectedFileId(data?.files?.[0]?.id ?? null);
      toast({
        title: "Preview generated",
        description: "Your workspace is ready to review before applying it to a project.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const applyPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!result) {
        throw new Error("Generate a preview before applying it to a project.");
      }
      const projectIdValue = projectId.trim();
      if (!projectIdValue) {
        throw new Error("Enter the project ID where the code should be applied.");
      }
      const parsedProjectId = Number(projectIdValue);
      if (Number.isNaN(parsedProjectId)) {
        throw new Error("Project ID must be a number.");
      }

      const data = await apiRequest('POST', `/api/ai/apply-preview/${result.id}`, {
        projectId: parsedProjectId,
      }) as unknown as { success: boolean; message?: string };
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Preview applied",
        description: data.message || "Files were copied into your project workspace.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Apply failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    let interval: number | undefined;
    if (generatePreviewMutation.isPending) {
      setProgress(8);
      interval = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 92) {
            return current;
          }
          return Math.min(current + 6, 92);
        });
      }, 400);
    } else if (generatePreviewMutation.isSuccess) {
      setProgress(100);
      const timeout = window.setTimeout(() => setProgress(0), 600);
      return () => {
        window.clearTimeout(timeout);
      };
    } else if (!generatePreviewMutation.isPending) {
      setProgress(0);
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [generatePreviewMutation.isPending, generatePreviewMutation.isSuccess]);

  useEffect(() => {
    if (!result) {
      setSelectedFileId(null);
    }
  }, [result]);

  const currentStepIndex = useMemo(() => {
    if (generatePreviewMutation.isSuccess) {
      return steps.length;
    }
    if (progress <= 0) {
      return 0;
    }
    const buckets = 100 / steps.length;
    return Math.min(steps.length - 1, Math.floor(progress / buckets));
  }, [generatePreviewMutation.isSuccess, progress]);

  const selectedFile = useMemo(
    () => result?.files.find((file) => file.id === selectedFileId) ?? result?.files[0],
    [result, selectedFileId],
  );

  const handleCopyFile = async (file: GeneratedFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFileId(file.id);
      toast({
        title: "Copied to clipboard",
        description: `${file.fileName} is ready to paste into your editor.`,
      });
      window.setTimeout(() => setCopiedFileId((current) => (current === file.id ? null : current)), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "We couldn't copy that file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderPreview = () => {
    if (!generatePreviewMutation.isSuccess || !result) {
      return (
        <div className="flex h-[480px] flex-col items-center justify-center gap-4 text-center text-muted-foreground">
          <Sparkles className="h-12 w-12 text-primary/70" />
          <div>
            <p className="text-[15px] font-medium text-foreground">Describe the product you want to build.</p>
            <p className="text-[13px] text-muted-foreground">
              The agent generates a deployable workspace, installs dependencies, and renders a live preview here.
            </p>
          </div>
        </div>
      );
    }

    return (
      <iframe
        title="AI generated preview"
        srcDoc={result.preview}
        className="h-[480px] w-full overflow-hidden rounded-xl border bg-background"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(88,86,214,0.08),_transparent_45%)] py-12">
      <div className="container-responsive max-w-7xl space-y-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge className="bg-gradient-to-r from-primary to-primary/80 text-white">Production-ready workflows</Badge>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Agent Studio
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">
                Turn natural language prompts into real, deployable applications. Connect a project, inspect every file, and push
                directly to production.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Average build time</p>
              <p className="text-2xl font-semibold">{result ? `${result.estimatedTime} min` : "~2 min"}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Files generated</p>
              <p className="text-2xl font-semibold">{result ? result.metrics.filesGenerated : "20+"}</p>
            </div>
            <div className="rounded-xl border bg-background/70 p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deploy readiness</p>
              <p className="text-2xl font-semibold">
                {result?.deployment.ready ? "Ready" : result ? "Review" : "Auto"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="border-primary/10 shadow-lg shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Describe your product
              </CardTitle>
              <CardDescription>
                The agent will architect your stack, generate code, and assemble a live workspace in seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  generatePreviewMutation.mutate(undefined);
                }}
              >
                <div className="space-y-2">
                  <label htmlFor="agent-prompt" className="text-[13px] font-medium text-foreground">
                    Prompt
                  </label>
                  <Textarea
                    id="agent-prompt"
                    rows={6}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ex: Build a collaborative note taking app with authentication, AI suggestions, and Stripe billing"
                    disabled={generatePreviewMutation.isPending}
                    data-testid="textarea-agent-prompt"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Preferred stack</label>
                    <Select
                      value={language}
                      onValueChange={setLanguage}
                      disabled={generatePreviewMutation.isPending}
                    >
                      <SelectTrigger data-testid="select-language">
                        <SelectValue placeholder="Select a language" />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground">Attach to project (optional)</label>
                    <Input
                      inputMode="numeric"
                      placeholder="Project ID"
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      disabled={generatePreviewMutation.isPending}
                      data-testid="input-project-id"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Provide a project ID to apply files instantly after review.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" size="lg" disabled={generatePreviewMutation.isPending} data-testid="button-generate-preview">
                    {generatePreviewMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating workspace
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" /> Generate preview
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!result || applyPreviewMutation.isPending}
                    onClick={() => applyPreviewMutation.mutate(undefined)}
                    data-testid="button-apply-preview"
                  >
                    {applyPreviewMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying
                      </>
                    ) : (
                      <>
                        <Rocket className="mr-2 h-4 w-4" /> Apply to project
                      </>
                    )}
                  </Button>
                  <p className="text-[13px] text-muted-foreground">
                    Preview before committing — no files are written until you apply them.
                  </p>
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Build progress</span>
                  <span className="text-[11px] text-muted-foreground">
                    {generatePreviewMutation.isPending ? "Working" : result ? "Completed" : "Idle"}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="space-y-4">
                  {steps.map((step, index) => {
                    const isComplete = currentStepIndex > index;
                    const isActive = currentStepIndex === index;
                    return (
                      <div
                        key={step.title}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                          isComplete && "border-primary/40 bg-primary/5",
                          isActive && !isComplete && "border-primary/50 bg-primary/5",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border",
                            isComplete && "border-primary bg-primary text-white",
                            isActive && !isComplete && "border-primary text-primary",
                            !isActive && !isComplete && "border-muted text-muted-foreground",
                          )}
                        >
                          {isComplete ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-foreground">{step.title}</p>
                          <p className="text-[13px] text-muted-foreground">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="overflow-hidden border-primary/10 shadow-lg shadow-primary/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    Live preview
                  </CardTitle>
                  <CardDescription>
                    Inspect the generated workspace exactly as end users will see it.
                  </CardDescription>
                </div>
                {result && (
                  <Badge variant="secondary" className="text-[11px] capitalize">
                    {result.complexity}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="bg-muted/30 p-0">
                {generatePreviewMutation.isPending && (
                  <Skeleton className="absolute inset-x-4 top-6 h-24 rounded-xl" />
                )}
                {renderPreview()}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Deployment summary
                </CardTitle>
                <CardDescription>
                  Validate the generated blueprint before syncing it with your repository.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result ? (
                  <>
                    <p className="text-[13px] text-muted-foreground">{result.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {result.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="capitalize">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lines of code</p>
                        <p className="text-[15px] font-semibold">{result.metrics.totalLinesOfCode.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tech stack</p>
                        <p className="text-[15px] font-semibold">{result.technologies.join(", ")}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tokens estimated</p>
                        <p className="text-[15px] font-semibold">{result.metrics.estimatedTokens.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deployment checklist</p>
                      <ul className="space-y-2 text-[13px] text-muted-foreground">
                        {result.deployment.instructions.map((instruction) => (
                          <li key={instruction} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>{instruction}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 text-[13px] text-muted-foreground">
                    <p>The agent will summarise the generated project footprint here.</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Generated features & integrations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Lines of code & estimated runtime cost
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Deployment instructions for production
                      </li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode2 className="h-5 w-5 text-primary" />
                  Generated files
                </CardTitle>
                <CardDescription>
                  Review every artifact before syncing it with your repo. Copy files or apply them automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  {result ? (
                    result.files.map((file) => {
                      const isActive = selectedFile?.id === file.id;
                      return (
                        <button
                          type="button"
                          key={file.id}
                          onClick={() => setSelectedFileId(file.id)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left text-[13px] transition",
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-muted text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                          data-testid={`button-file-${file.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{file.fileName}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {file.language}
                            </Badge>
                          </div>
                          {file.description && (
                            <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{file.description}</p>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="space-y-2 text-[13px] text-muted-foreground">
                      <p>The agent will list generated files here.</p>
                      <p>Expect complete source, configuration, and documentation assets.</p>
                    </div>
                  )}
                </div>
                <div className="min-h-[320px] rounded-lg border bg-muted/30 p-4">
                  {selectedFile ? (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3 border-b pb-3">
                        <div>
                          <p className="font-semibold text-foreground">{selectedFile.fileName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedFile.dependencies?.length
                              ? `Dependencies: ${selectedFile.dependencies.join(", ")}`
                              : "No external dependencies"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyFile(selectedFile)}
                          data-testid="button-copy-file"
                        >
                          {copiedFileId === selectedFile.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Tabs defaultValue="code" className="mt-4 flex h-full flex-col" data-testid="tabs-file-view">
                        <TabsList className="w-fit">
                          <TabsTrigger value="code" data-testid="tab-source">Source</TabsTrigger>
                          <TabsTrigger value="preview" data-testid="tab-rendered">Rendered</TabsTrigger>
                        </TabsList>
                        <TabsContent value="code" className="mt-4 flex-1 overflow-auto">
                          <pre className="max-h-[360px] whitespace-pre-wrap rounded-md bg-background p-4 text-[11px] text-foreground">
                            <code>{selectedFile.content}</code>
                          </pre>
                        </TabsContent>
                        <TabsContent value="preview" className="mt-4 flex-1 overflow-hidden rounded-md border bg-background">
                          {selectedFile.fileName.endsWith(".html") ? (
                            <iframe
                              title={`Preview of ${selectedFile.fileName}`}
                              className="h-full w-full"
                              srcDoc={selectedFile.content}
                              sandbox="allow-scripts allow-same-origin"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-6 text-[13px] text-muted-foreground">
                              Rendering is only available for HTML files.
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                      Select a file to inspect its source.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
