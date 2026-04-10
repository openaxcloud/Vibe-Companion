/**
 * Git Graph - Visual commit history with branches
 * Inspired by GitKraken and VS Code Git Graph
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  GitBranch,
  GitCommit,
  GitMerge,
  Search,
  Calendar,
  User,
  Hash,
  Copy,
  ExternalLink,
  Tag,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface GitCommitNode {
  hash: string;
  shortHash: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  date: Date;
  parents: string[];
  branches: string[];
  tags: string[];
  isMerge: boolean;
}

interface ApiCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

interface CommitLogResponse {
  commits: ApiCommit[];
}

interface GitGraphProps {
  projectId: string | number;
  className?: string;
  onCommitClick?: (commit: GitCommitNode) => void;
  maxCommits?: number;
}

export function GitGraph({
  projectId,
  className,
  onCommitClick,
  maxCommits = 100
}: GitGraphProps) {
  const [filteredCommits, setFilteredCommits] = useState<GitCommitNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const { data: logData, isLoading, error, refetch } = useQuery<CommitLogResponse>({
    queryKey: ['/api/git/projects', projectId, 'commits', maxCommits],
    queryFn: async () => {
      const response = await fetch(`/api/git/projects/${projectId}/commits?limit=${maxCommits}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch commit log');
      }
      const data = await response.json();
      return { commits: Array.isArray(data) ? data : (data.commits || []) };
    }
  });

  const commits: GitCommitNode[] = (logData?.commits || []).map((commit, index) => ({
    hash: commit.hash,
    shortHash: commit.shortHash,
    message: commit.message,
    author: {
      name: commit.author,
      email: ''
    },
    date: new Date(commit.date),
    parents: index < (logData?.commits?.length || 0) - 1 
      ? [logData?.commits[index + 1]?.shortHash || ''] 
      : [],
    branches: index === 0 ? ['HEAD'] : [],
    tags: [],
    isMerge: commit.message.toLowerCase().includes('merge')
  }));

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommits(commits);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = commits.filter(commit =>
      commit.message.toLowerCase().includes(query) ||
      commit.author.name.toLowerCase().includes(query) ||
      commit.shortHash.includes(query)
    );

    setFilteredCommits(filtered);
  }, [searchQuery, commits]);

  useEffect(() => {
    if (!canvasRef.current || filteredCommits.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 60;
    const height = filteredCommits.length * 50;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    filteredCommits.forEach((commit, index) => {
      const x = 30;
      const y = index * 50 + 25;

      if (index > 0) {
        ctx.strokeStyle = commit.isMerge ? '#F99D25' : '#F26207';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - 25);
        ctx.lineTo(x, y - 10);
        ctx.stroke();
      }

      ctx.fillStyle = commit.isMerge ? '#F99D25' : '#F26207';
      ctx.beginPath();
      ctx.arc(x, y, commit.isMerge ? 6 : 5, 0, 2 * Math.PI);
      ctx.fill();

      if (selectedCommit === commit.hash) {
        ctx.strokeStyle = '#F26207';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  }, [filteredCommits, selectedCommit]);

  const handleCommitClick = (commit: GitCommitNode) => {
    setSelectedCommit(commit.hash);
    if (onCommitClick) {
      onCommitClick(commit);
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: "Copied to clipboard",
      description: "Commit hash copied successfully",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Git Graph
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            </Button>
            <Badge variant="outline" className="text-[11px]">
              {filteredCommits.length} commits
            </Badge>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search commits, authors, hashes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-[11px]"
            data-testid="input-search-commits"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading git history...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-[13px] text-muted-foreground">
            <GitCommit className="h-8 w-8 mb-2 opacity-50" />
            <p>Failed to load git history</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : filteredCommits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[13px] text-muted-foreground">
            <GitCommit className="h-8 w-8 mb-2 opacity-50" />
            <p>No commits found</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex">
              <div className="flex-shrink-0">
                <canvas ref={canvasRef} className="block" />
              </div>

              <div className="flex-1 px-3 py-2">
                {filteredCommits.map((commit, index) => (
                  <div
                    key={commit.hash}
                    className={cn(
                      "group relative py-2 px-3 rounded-lg cursor-pointer transition-all",
                      "hover:bg-muted/50",
                      selectedCommit === commit.hash && "bg-muted ring-1 ring-[var(--ecode-orange)]/20"
                    )}
                    style={{ marginTop: index === 0 ? '4px' : '0' }}
                    onClick={() => handleCommitClick(commit)}
                    data-testid={`commit-item-${commit.shortHash}`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      {commit.isMerge && (
                        <GitMerge className="h-3.5 w-3.5 mt-0.5 text-[var(--ecode-yellow)] flex-shrink-0" />
                      )}
                      <p className="text-[11px] font-medium line-clamp-2 flex-1">
                        {commit.message}
                      </p>
                    </div>

                    {(commit.branches.length > 0 || commit.tags.length > 0) && (
                      <div className="flex items-center gap-1 mb-1">
                        {commit.branches.map(branch => (
                          <Badge
                            key={branch}
                            variant="outline"
                            className="h-4 text-[10px] px-1 bg-[var(--ecode-orange)]/10 text-[var(--ecode-orange)] border-[var(--ecode-orange)]/20"
                          >
                            <GitBranch className="h-2.5 w-2.5 mr-0.5" />
                            {branch}
                          </Badge>
                        ))}
                        {commit.tags.map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-4 text-[10px] px-1 bg-green-500/10 text-green-600 border-green-500/20"
                          >
                            <Tag className="h-2.5 w-2.5 mr-0.5" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">
                            {getInitials(commit.author.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate max-w-[100px]">{commit.author.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        <span>{formatDistanceToNow(commit.date, { addSuffix: true })}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        <span className="font-mono">{commit.shortHash}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyHash(commit.hash);
                          }}
                          data-testid={`button-copy-hash-${commit.shortHash}`}
                        >
                          <Copy className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
