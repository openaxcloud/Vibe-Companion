import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitCommit,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Clock,
  RotateCcw,
  Eye,
  Code2,
  FileText,
  Plus,
  Minus,
  Edit,
  ChevronRight,
  ChevronDown,
  Calendar,
  User,
  Tag,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface HistoryEntry {
  id: string;
  type: 'commit' | 'branch' | 'merge' | 'tag' | 'restore';
  title: string;
  description?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  hash: string;
  changes: {
    additions: number;
    deletions: number;
    files: Array<{
      name: string;
      status: 'added' | 'modified' | 'deleted';
      additions: number;
      deletions: number;
    }>;
  };
  tags?: string[];
  branch?: string;
  isRestorePoint?: boolean;
}

interface HistoryTimelineProps {
  projectId: number;
  className?: string;
}

export function HistoryTimeline({ projectId, className }: HistoryTimelineProps) {
  const { toast } = useToast();
  const [history] = useState<HistoryEntry[]>([
    {
      id: '1',
      type: 'commit',
      title: 'Fix API error handling and add retry logic',
      description: 'Improved error handling for failed API requests with exponential backoff',
      author: {
        id: '1',
        name: 'Alice Chen',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      },
      timestamp: new Date(Date.now() - 3600000),
      hash: '7f8d9c2',
      changes: {
        additions: 42,
        deletions: 15,
        files: [
          { name: 'src/api/client.ts', status: 'modified', additions: 35, deletions: 10 },
          { name: 'src/utils/retry.ts', status: 'added', additions: 7, deletions: 0 },
          { name: 'src/old-api.ts', status: 'deleted', additions: 0, deletions: 5 },
        ],
      },
      tags: ['bugfix', 'api'],
      branch: 'main',
      isRestorePoint: true,
    },
    {
      id: '2',
      type: 'tag',
      title: 'v1.2.0 Release',
      description: 'New features: Dark mode, improved performance, bug fixes',
      author: {
        id: '2',
        name: 'Bob Smith',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
      },
      timestamp: new Date(Date.now() - 7200000),
      hash: '3b5a7f1',
      changes: {
        additions: 250,
        deletions: 120,
        files: [],
      },
      tags: ['release'],
    },
    {
      id: '3',
      type: 'merge',
      title: 'Merge pull request #42 from feature/dark-mode',
      description: 'Add dark mode support',
      author: {
        id: '3',
        name: 'Carol Davis',
      },
      timestamp: new Date(Date.now() - 14400000),
      hash: '9e2f4a8',
      changes: {
        additions: 180,
        deletions: 45,
        files: [
          { name: 'src/styles/theme.css', status: 'added', additions: 120, deletions: 0 },
          { name: 'src/components/ThemeToggle.tsx', status: 'added', additions: 60, deletions: 0 },
          { name: 'src/index.css', status: 'modified', additions: 0, deletions: 45 },
        ],
      },
      branch: 'feature/dark-mode',
    },
  ]);

  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'graph'>('timeline');

  const getEntryIcon = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'commit':
        return <GitCommit className="h-4 w-4" />;
      case 'branch':
        return <GitBranch className="h-4 w-4" />;
      case 'merge':
        return <GitMerge className="h-4 w-4" />;
      case 'tag':
        return <Tag className="h-4 w-4" />;
      case 'restore':
        return <RotateCcw className="h-4 w-4" />;
    }
  };

  const getEntryColor = (type: HistoryEntry['type']) => {
    switch (type) {
      case 'commit':
        return 'text-blue-500';
      case 'branch':
        return 'text-purple-500';
      case 'merge':
        return 'text-green-500';
      case 'tag':
        return 'text-yellow-500';
      case 'restore':
        return 'text-orange-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'text-green-500';
      case 'modified':
        return 'text-yellow-500';
      case 'deleted':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const handleRestore = (entry: HistoryEntry) => {
    toast({
      title: "Restoring to checkpoint",
      description: `Rolling back to ${entry.title} (${entry.hash})`,
    });
  };

  const handleView = (entry: HistoryEntry) => {
    toast({
      title: "Viewing checkpoint",
      description: `Opening ${entry.hash} in read-only mode`,
    });
  };

  const handleDownload = (entry: HistoryEntry) => {
    toast({
      title: "Downloading snapshot",
      description: `Preparing download for ${entry.hash}`,
    });
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedEntry(expandedEntry === entryId ? null : entryId);
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            History Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === 'timeline' ? 'default' : 'outline'}
              onClick={() => setViewMode('timeline')}
              className="h-8"
            >
              Timeline
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'graph' ? 'default' : 'outline'}
              onClick={() => setViewMode('graph')}
              className="h-8"
            >
              Graph
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100%-4rem)]">
          <div className="p-4">
            {viewMode === 'timeline' ? (
              <div className="space-y-4">
                {history.map((entry, index) => (
                  <div key={entry.id} className="relative">
                    {/* Timeline Line */}
                    {index < history.length - 1 && (
                      <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-border" />
                    )}

                    <div className="flex gap-3">
                      {/* Timeline Node */}
                      <div
                        className={cn(
                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background",
                          getEntryColor(entry.type)
                        )}
                      >
                        {getEntryIcon(entry.type)}
                      </div>

                      {/* Entry Content */}
                      <div className="flex-1 pb-4">
                        <div
                          className="cursor-pointer rounded-lg border p-3 transition-colors hover:bg-muted/50"
                          onClick={() => toggleExpanded(entry.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-[13px] font-medium">
                                  {entry.title}
                                </h4>
                                {entry.isRestorePoint && (
                                  <Badge variant="outline" className="text-[11px]">
                                    Restore Point
                                  </Badge>
                                )}
                              </div>
                              {entry.description && (
                                <p className="text-[11px] text-muted-foreground mb-2">
                                  {entry.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={entry.author.avatar} />
                                    <AvatarFallback className="text-[11px]">
                                      {entry.author.name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{entry.author.name}</span>
                                </div>
                                <span>{formatTime(entry.timestamp)}</span>
                                <code className="font-mono">{entry.hash}</code>
                                {entry.branch && (
                                  <div className="flex items-center gap-1">
                                    <GitBranch className="h-3 w-3" />
                                    <span>{entry.branch}</span>
                                  </div>
                                )}
                              </div>
                              {entry.tags && entry.tags.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {entry.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-[11px]">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                            >
                              {expandedEntry === entry.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          {/* Expanded Content */}
                          {expandedEntry === entry.id && (
                            <>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                {/* Change Summary */}
                                <div className="flex items-center gap-4 text-[11px]">
                                  <div className="flex items-center gap-1">
                                    <Plus className="h-3 w-3 text-green-500" />
                                    <span>{entry.changes.additions} additions</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Minus className="h-3 w-3 text-red-500" />
                                    <span>{entry.changes.deletions} deletions</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    <span>{entry.changes.files.length} files changed</span>
                                  </div>
                                </div>

                                {/* Changed Files */}
                                {entry.changes.files.length > 0 && (
                                  <div className="space-y-1">
                                    {entry.changes.files.map((file) => (
                                      <div
                                        key={file.name}
                                        className="flex items-center justify-between text-[11px]"
                                      >
                                        <div className="flex items-center gap-2">
                                          <Code2 className={cn("h-3 w-3", getStatusColor(file.status))} />
                                          <span className="font-mono">{file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-green-500">+{file.additions}</span>
                                          <span className="text-red-500">-{file.deletions}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleView(entry);
                                    }}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    View
                                  </Button>
                                  {entry.isRestorePoint && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRestore(entry);
                                      }}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                      Restore
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(entry);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Graph View Placeholder
              <div className="flex items-center justify-center h-96 text-muted-foreground">
                <div className="text-center">
                  <GitPullRequest className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-[13px]">Graph view coming soon</p>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}