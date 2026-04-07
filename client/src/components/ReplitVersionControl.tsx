// @ts-nocheck
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  GitPullRequest,
  Plus,
  Minus,
  FileText,
  FolderOpen,
  Check,
  X,
  Clock,
  ChevronRight,
  RefreshCw,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GitCommit {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  date: Date;
  branch: string;
  files: GitFile[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

interface GitFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: GitHunk[];
}

interface GitHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: GitLine[];
}

interface GitLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  lineNumber?: number;
}

interface GitBranch {
  name: string;
  isActive: boolean;
  lastCommit: {
    id: string;
    message: string;
    date: Date;
  };
  ahead: number;
  behind: number;
}

interface VersionControlProps {
  projectId: number;
  className?: string;
}

export function ReplitVersionControl({ projectId, className }: VersionControlProps) {
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch git status
  const { data: gitStatus } = useQuery<{ changes: GitFile[] }>({
    queryKey: [`/api/git/${projectId}/status`]
  });

  // Fetch commit history
  const { data: commits = [] } = useQuery<GitCommit[]>({
    queryKey: [`/api/git/${projectId}/commits`]
  });

  // Fetch branches
  const { data: branches = [] } = useQuery<GitBranch[]>({
    queryKey: [`/api/git/${projectId}/branches`]
  });

  // Commit changes mutation
  const commitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/git/${projectId}/commit`, {
        message: commitMessage,
        files: Array.from(selectedFiles)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/${projectId}`] });
      setCommitMessage('');
      setSelectedFiles(new Set());
      toast({
        title: 'Changes committed',
        description: 'Your changes have been committed successfully'
      });
    }
  });

  // Pull changes mutation
  const pullMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/git/${projectId}/pull`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/${projectId}`] });
      toast({
        title: 'Changes pulled',
        description: 'Latest changes have been pulled from remote'
      });
    }
  });

  // Push changes mutation
  const pushMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/git/${projectId}/push`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/git/${projectId}`] });
      toast({
        title: 'Changes pushed',
        description: 'Your changes have been pushed to remote'
      });
    }
  });

  const getFileIcon = (status: string) => {
    switch (status) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'modified':
        return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'deleted':
        return <Minus className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const renderDiffLine = (line: GitLine, index: number) => {
    const bgColor = line.type === 'add' ? 'bg-green-50 dark:bg-green-950/30' : 
                    line.type === 'delete' ? 'bg-red-50 dark:bg-red-950/30' : '';
    const textColor = line.type === 'add' ? 'text-green-600' : 
                      line.type === 'delete' ? 'text-red-600' : 'text-muted-foreground';
    const prefix = line.type === 'add' ? '+' : 
                   line.type === 'delete' ? '-' : ' ';

    return (
      <div
        key={index}
        className={cn("font-mono text-[11px] px-2 py-0.5", bgColor, textColor)}
      >
        <span className="select-none mr-2">{prefix}</span>
        <span>{line.content}</span>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card className={cn("h-full flex flex-col", className)}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Version Control
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pullMutation.mutate()}
                disabled={pullMutation.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Pull
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pushMutation.mutate()}
                disabled={pushMutation.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                Push
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => queryClient.invalidateQueries({ queryKey: [`/api/git/${projectId}`] })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <Tabs defaultValue="changes" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="changes">
              Changes
              {gitStatus?.changes && gitStatus.changes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {gitStatus.changes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
          </TabsList>

          <TabsContent value="changes" className="flex-1 flex flex-col mt-0">
            <CardContent className="flex-1 flex flex-col p-4">
              {gitStatus?.changes && gitStatus.changes.length > 0 ? (
                <>
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-2">
                      {gitStatus.changes.map((file: GitFile) => (
                        <div
                          key={file.path}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer",
                            selectedFiles.has(file.path) && "bg-muted"
                          )}
                          onClick={() => {
                            const newSelected = new Set(selectedFiles);
                            if (newSelected.has(file.path)) {
                              newSelected.delete(file.path);
                            } else {
                              newSelected.add(file.path);
                            }
                            setSelectedFiles(newSelected);
                            setSelectedFile(file);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.path)}
                              onChange={() => {}}
                              className="cursor-pointer"
                            />
                            {getFileIcon(file.status)}
                            <span className="text-[13px]">{file.path}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="text-green-600">+{file.additions}</span>
                            <span className="text-red-600">-{file.deletions}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <Textarea
                      placeholder="Commit message..."
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button
                      className="w-full"
                      onClick={() => commitMutation.mutate()}
                      disabled={!commitMessage || selectedFiles.size === 0 || commitMutation.isPending}
                    >
                      <GitCommit className="h-4 w-4 mr-2" />
                      Commit {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-[15px] font-medium">Working tree clean</p>
                    <p className="text-[13px] text-muted-foreground">No changes to commit</p>
                  </div>
                </div>
              )}
            </CardContent>
          </TabsContent>

          <TabsContent value="history" className="flex-1 mt-0">
            <CardContent className="flex h-full p-0">
              <div className="w-1/3 border-r">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {commits.map((commit) => (
                      <div
                        key={commit.id}
                        className={cn(
                          "p-3 rounded-md cursor-pointer hover:bg-muted",
                          selectedCommit?.id === commit.id && "bg-muted"
                        )}
                        onClick={() => setSelectedCommit(commit)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={commit.author.avatarUrl} />
                              <AvatarFallback>{commit.author.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-[13px] font-medium line-clamp-1">{commit.message}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {commit.author.name} • {new Date(commit.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[11px]">
                            {commit.id.slice(0, 7)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                          <span>{commit.stats.filesChanged} files</span>
                          <span className="text-green-600">+{commit.stats.additions}</span>
                          <span className="text-red-600">-{commit.stats.deletions}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex-1">
                {selectedCommit ? (
                  <div className="h-full flex flex-col">
                    <div className="px-2.5 py-2 border-b border-[var(--ecode-border)] shrink-0">
                      <span className="text-xs font-medium text-[var(--ecode-text)]">{selectedCommit.message}</span>
                      <p className="text-[10px] text-[var(--ecode-text-muted)] mt-0.5">
                        {selectedCommit.author.name} committed on {new Date(selectedCommit.date).toLocaleString()}
                      </p>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-4">
                        {selectedCommit.files.map((file) => (
                          <div key={file.path} className="space-y-2">
                            <div className="flex items-center gap-2">
                              {getFileIcon(file.status)}
                              <span className="text-[13px] font-medium">{file.path}</span>
                              <Badge variant="secondary" className="text-[11px]">
                                +{file.additions} -{file.deletions}
                              </Badge>
                            </div>
                            <div className="border rounded-md overflow-hidden">
                              {file.hunks.map((hunk, hunkIndex) => (
                                <div key={hunkIndex}>
                                  <div className="bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground">
                                    @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                                  </div>
                                  {hunk.lines.map((line, lineIndex) => renderDiffLine(line, lineIndex))}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Select a commit to view changes
                  </div>
                )}
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="branches" className="flex-1 mt-0">
            <CardContent className="h-full p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <div
                      key={branch.name}
                      className={cn(
                        "p-3 rounded-md border",
                        branch.isActive && "border-primary bg-primary/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <span className="font-medium">{branch.name}</span>
                          {branch.isActive && (
                            <Badge variant="secondary" className="text-[11px]">Active</Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[13px] text-muted-foreground mt-2">
                        {branch.lastCommit.message}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span>{new Date(branch.lastCommit.date).toLocaleDateString()}</span>
                        {branch.ahead > 0 && (
                          <span className="text-green-600">↑ {branch.ahead}</span>
                        )}
                        {branch.behind > 0 && (
                          <span className="text-red-600">↓ {branch.behind}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </TooltipProvider>
  );
}