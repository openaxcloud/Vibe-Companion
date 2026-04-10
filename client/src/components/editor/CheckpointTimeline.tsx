import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  History,
  Clock,
  Bookmark,
  Zap,
  AlertTriangle,
  Shield,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCheckpoints, type CreateCheckpointData } from "@/hooks/useCheckpoints";
import type { Checkpoint } from "@shared/schema";
import { cn } from "@/lib/utils";

const createCheckpointSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  type: z.enum(["manual", "automatic", "before_action", "error_recovery"]).default("manual"),
});

type CreateCheckpointForm = z.infer<typeof createCheckpointSchema>;

interface CheckpointTimelineProps {
  projectId: number;
  userId: number;
  className?: string;
}

const checkpointTypeConfig = {
  manual: {
    icon: Bookmark,
    label: "Manual",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  automatic: {
    icon: Zap,
    label: "Automatic",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  before_action: {
    icon: Shield,
    label: "Pre-action",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  error_recovery: {
    icon: AlertTriangle,
    label: "Recovery",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
};

function formatTimestamp(timestamp: string | Date | null): string {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function CheckpointNode({
  checkpoint,
  isCurrent,
  onRollback,
  onDelete,
  isRollingBack,
  isDeletingCheckpoint,
}: {
  checkpoint: Checkpoint;
  isCurrent: boolean;
  onRollback: (checkpointId: number) => void;
  onDelete: (checkpointId: number) => void;
  isRollingBack: boolean;
  isDeletingCheckpoint: boolean;
}) {
  const type = (checkpoint.type as keyof typeof checkpointTypeConfig) || "manual";
  const config = checkpointTypeConfig[type] || checkpointTypeConfig.manual;
  const TypeIcon = config.icon;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 p-3 rounded-lg border transition-all hover:bg-muted/50",
        isCurrent ? "bg-primary/5 border-primary/30" : "border-border/50",
        config.bgColor
      )}
      data-testid={`checkpoint-node-${checkpoint.id}`}
    >
      <div className="flex-shrink-0 relative">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2",
            isCurrent ? "border-primary bg-primary/10" : config.borderColor,
            config.bgColor
          )}
        >
          {isCurrent ? (
            <CheckCircle2 className="w-5 h-5 text-primary" />
          ) : (
            <TypeIcon className={cn("w-5 h-5", config.color)} />
          )}
        </div>
        <div className="absolute left-5 top-12 w-px h-full bg-border -z-10" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4
                className="font-medium text-[13px] truncate"
                data-testid={`text-checkpoint-name-${checkpoint.id}`}
              >
                {checkpoint.name}
              </h4>
              {isCurrent && (
                <Badge variant="default" className="text-[11px]" data-testid="current-checkpoint-badge">
                  Current
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[11px]", config.color)}>
                {config.label}
              </Badge>
            </div>
            {checkpoint.description && (
              <p
                className="text-[11px] text-muted-foreground line-clamp-2 mb-1"
                data-testid={`checkpoint-description-${checkpoint.id}`}
              >
                {checkpoint.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span data-testid={`checkpoint-timestamp-${checkpoint.id}`}>
                {formatTimestamp(checkpoint.createdAt)}
              </span>
              {checkpoint.changedFiles && (checkpoint.changedFiles as string[]).length > 0 && (
                <span className="text-muted-foreground">
                  • {(checkpoint.changedFiles as string[]).length} files changed
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {!isCurrent && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRollback(checkpoint.id)}
                      disabled={isRollingBack}
                      data-testid={`rollback-to-checkpoint-${checkpoint.id}`}
                    >
                      {isRollingBack ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rollback to this checkpoint</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={isDeletingCheckpoint}
                        data-testid={`button-delete-checkpoint-${checkpoint.id}`}
                      >
                        {isDeletingCheckpoint ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Delete checkpoint</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Checkpoint</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the checkpoint "{checkpoint.name}"? This action
                    cannot be undone and will permanently remove this checkpoint from your project
                    history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="cancel-delete-checkpoint">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(checkpoint.id)}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="confirm-delete-checkpoint"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckpointTimeline({ projectId, userId, className }: CheckpointTimelineProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const {
    checkpoints,
    isLoadingCheckpoints,
    navigation,
    isLoadingNavigation,
    createCheckpoint,
    isCreatingCheckpoint,
    rollback,
    isRollingBack,
    rollforward,
    isRollingForward,
    deleteCheckpoint,
    isDeletingCheckpoint,
  } = useCheckpoints(projectId);

  const form = useForm<CreateCheckpointForm>({
    resolver: zodResolver(createCheckpointSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "manual",
    },
  });

  const handleCreateCheckpoint = (data: CreateCheckpointForm) => {
    const checkpointData: CreateCheckpointData = {
      projectId,
      userId,
      name: data.name,
      description: data.description,
      type: data.type,
      includeDatabase: true,
      includeEnvironment: true,
    };

    createCheckpoint(checkpointData, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        form.reset();
      },
    });
  };

  const handleRollback = (checkpointId: number) => {
    rollback({
      projectId,
      checkpointId,
      userId,
      restoreConversation: false,
    });
  };

  const handleRollforward = () => {
    if (navigation?.nextCheckpoint) {
      rollforward({
        projectId,
        checkpointId: navigation.nextCheckpoint.id,
        userId,
        restoreConversation: false,
      });
    }
  };

  const handleNavigateBack = () => {
    if (navigation?.previousCheckpoint) {
      rollback({
        projectId,
        checkpointId: navigation.previousCheckpoint.id,
        userId,
        restoreConversation: false,
      });
    }
  };

  const handleDelete = (checkpointId: number) => {
    deleteCheckpoint(checkpointId);
  };

  const currentCheckpointId = navigation?.currentCheckpoint?.id;

  const isLoading = isLoadingCheckpoints || isLoadingNavigation;
  const isNavigating = isRollingBack || isRollingForward;

  return (
    <Card className={cn("flex flex-col", className)} data-testid="checkpoint-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-[15px]">Checkpoint Timeline</CardTitle>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-checkpoint">
                <Plus className="w-4 h-4 mr-1" />
                Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Checkpoint</DialogTitle>
                <DialogDescription>
                  Save the current state of your project as a checkpoint. You can rollback to this
                  checkpoint at any time.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateCheckpoint)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Before major refactor"
                            {...field}
                            data-testid="input-checkpoint-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what this checkpoint contains..."
                            {...field}
                            data-testid="input-checkpoint-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Add notes to help you remember what this checkpoint contains.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-checkpoint-type">
                              <SelectValue placeholder="Select checkpoint type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual Checkpoint</SelectItem>
                            <SelectItem value="automatic">Automatic</SelectItem>
                            <SelectItem value="before_action">Pre-action</SelectItem>
                            <SelectItem value="error_recovery">Error Recovery</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="cancel-create-checkpoint"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreatingCheckpoint}
                      data-testid="submit-create-checkpoint"
                    >
                      {isCreatingCheckpoint ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Checkpoint"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""} saved
        </CardDescription>
      </CardHeader>

      <div className="px-4 pb-3 flex items-center justify-between gap-2 border-b">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNavigateBack}
                disabled={!navigation?.canRollback || isNavigating}
                data-testid="button-rollback"
              >
                {isRollingBack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
                <span className="ml-1">Back</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {navigation?.canRollback
                ? `Rollback to: ${navigation.previousCheckpoint?.name}`
                : "No previous checkpoint"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {navigation?.currentCheckpoint ? (
            <>
              <Circle className="w-3 h-3 fill-primary text-primary" />
              <span className="truncate max-w-[150px]" data-testid="current-checkpoint-name">
                {navigation.currentCheckpoint.name}
              </span>
            </>
          ) : (
            <span>No checkpoint active</span>
          )}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRollforward}
                disabled={!navigation?.canRollforward || isNavigating}
                data-testid="button-rollforward"
              >
                <span className="mr-1">Forward</span>
                {isRollingForward ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {navigation?.canRollforward
                ? `Rollforward to: ${navigation.nextCheckpoint?.name}`
                : "No next checkpoint"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32" data-testid="loading-checkpoints">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : checkpoints.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-32 text-center p-4"
              data-testid="empty-checkpoints"
            >
              <History className="w-10 h-10 text-muted-foreground mb-2" />
              <p className="text-[13px] text-muted-foreground">No checkpoints yet</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Create a checkpoint to save your project state
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-2" data-testid="checkpoints-list">
              {checkpoints.map((checkpoint) => (
                <CheckpointNode
                  key={checkpoint.id}
                  checkpoint={checkpoint}
                  isCurrent={checkpoint.id === currentCheckpointId}
                  onRollback={handleRollback}
                  onDelete={handleDelete}
                  isRollingBack={isRollingBack}
                  isDeletingCheckpoint={isDeletingCheckpoint}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default CheckpointTimeline;
