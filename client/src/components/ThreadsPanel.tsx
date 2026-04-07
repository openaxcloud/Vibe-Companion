import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquareText,
  MessageSquareReply,
  MessageCircle,
  Users,
  Clock,
  Tag,
  Search,
  Filter,
  Plus,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThreadComment {
  id: string;
  author: string;
  avatar?: string;
  timestamp: string;
  content: string;
  resolved?: boolean;
}

interface ThreadItem {
  id: string;
  title: string;
  filePath: string;
  line: number;
  participants: string[];
  status: 'open' | 'resolved' | 'archived';
  lastUpdated: string;
  labels?: string[];
  comments: ThreadComment[];
}

interface ThreadsPanelProps {
  projectId: number;
  className?: string;
}

const SAMPLE_THREADS: ThreadItem[] = [
  {
    id: 'thread-1',
    title: 'Discuss database connection pooling strategy',
    filePath: 'server/database/pool.ts',
    line: 87,
    participants: ['Alice', 'Carlos', 'Fatima'],
    status: 'open',
    lastUpdated: '5 minutes ago',
    labels: ['backend', 'performance'],
    comments: [
      {
        id: 'comment-1',
        author: 'Alice',
        timestamp: '10 minutes ago',
        content: 'I noticed occasional connection spikes when we deploy to staging. Maybe we should bump the pool size?',
      },
      {
        id: 'comment-2',
        author: 'Carlos',
        timestamp: '7 minutes ago',
        content: 'Agree. We can mirror Replit\'s defaults of 20 idle connections and add jittered backoff.',
      },
      {
        id: 'comment-3',
        author: 'Fatima',
        timestamp: '5 minutes ago',
        content: 'Captured some metrics from the Runtime Insights tab – dropping them here.',
      }
    ]
  },
  {
    id: 'thread-2',
    title: 'Clarify design tokens usage in sidebar component',
    filePath: 'client/src/components/layout/ReplitSidebar.tsx',
    line: 132,
    participants: ['Morgan', 'Priya'],
    status: 'open',
    lastUpdated: '32 minutes ago',
    labels: ['design', 'ui'],
    comments: [
      {
        id: 'comment-1',
        author: 'Morgan',
        timestamp: '45 minutes ago',
        content: 'Let\'s audit color usage to ensure accessibility ratios stay above 4.5:1.',
      },
      {
        id: 'comment-2',
        author: 'Priya',
        timestamp: '32 minutes ago',
        content: 'Updated the hover state to use `--ecode-sidebar-hover`. Ready for review!',
        resolved: true
      }
    ]
  },
  {
    id: 'thread-3',
    title: 'Refactor agent prompt templating',
    filePath: 'server/ai/advanced-ai-service.ts',
    line: 211,
    participants: ['Theo', 'Jules'],
    status: 'resolved',
    lastUpdated: 'Yesterday',
    labels: ['ai', 'refactor'],
    comments: [
      {
        id: 'comment-1',
        author: 'Theo',
        timestamp: 'Yesterday',
        content: 'We should split the prompt builder into smaller composable helpers.',
      },
      {
        id: 'comment-2',
        author: 'Jules',
        timestamp: 'Yesterday',
        content: 'Done in #542 – closing the loop.',
        resolved: true
      }
    ]
  }
];

export function ThreadsPanel({ projectId, className }: ThreadsPanelProps) {
  const [search, setSearch] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string>(SAMPLE_THREADS[0]?.id ?? '');
  const [newReply, setNewReply] = useState('');

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return SAMPLE_THREADS;

    const term = search.toLowerCase();
    return SAMPLE_THREADS.filter((thread) =>
      thread.title.toLowerCase().includes(term) ||
      thread.filePath.toLowerCase().includes(term) ||
      thread.participants.some((participant) => participant.toLowerCase().includes(term))
    );
  }, [search]);

  const activeThread = filteredThreads.find((thread) => thread.id === activeThreadId) ?? filteredThreads[0];

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            <div>
              <CardTitle className="text-base">Threads</CardTitle>
              <CardDescription>
                Discuss code inline and keep feedback tied to files.
              </CardDescription>
            </div>
          </div>
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            New thread
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search threads, files, or people"
              className="pl-8 h-9"
            />
          </div>
          <Button size="sm" variant="ghost" className="h-9">
            <Filter className="h-4 w-4 mr-1" />
            Filters
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] h-full">
          <ScrollArea className="border-r border-border/60 xl:block hidden">
            <div className="p-3 space-y-2">
              {filteredThreads.map((thread) => {
                const participantCount = thread.participants.length;
                const isActive = activeThread?.id === thread.id;

                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={cn(
                      'w-full text-left rounded-md border px-3 py-2 transition-colors',
                      isActive
                        ? 'border-[var(--ecode-accent)] bg-[var(--ecode-surface)]'
                        : 'border-transparent hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium truncate">{thread.title}</span>
                      <Badge variant={thread.status === 'resolved' ? 'secondary' : 'default'} className="text-[10px]">
                        {thread.status === 'resolved' ? 'Resolved' : 'Open'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                      <span>{thread.filePath}</span>
                      <span>•</span>
                      <span>L{thread.line}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {participantCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {thread.comments.length}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {thread.lastUpdated}
                      </span>
                    </div>
                    {thread.labels && thread.labels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {thread.labels.map((label) => (
                          <Badge key={label} variant="outline" className="text-[10px]">
                            <Tag className="h-3 w-3 mr-1" />
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}

              {filteredThreads.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-8">
                  No threads match your search yet.
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex flex-col">
            {activeThread ? (
              <div className="flex flex-col h-full">
                <div className="h-9 px-2.5 flex items-center justify-between border-b border-[var(--ecode-border)] shrink-0">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="text-xs font-medium text-[var(--ecode-text)]">{activeThread.title}</span>
                      <p className="text-[10px] text-[var(--ecode-text-muted)]">
                        {activeThread.filePath} • Line {activeThread.line}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={activeThread.status === 'resolved' ? 'secondary' : 'default'} className="text-[10px] h-5">
                      {activeThread.status === 'resolved' ? 'Resolved' : 'Open'}
                    </Badge>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                      Resolve
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {activeThread.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md border border-border/60 p-3 bg-muted/20">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="font-medium text-[var(--ecode-text)]">{comment.author}</span>
                          <span>{comment.timestamp}</span>
                        </div>
                        <p className="text-[13px] mt-2 text-[var(--ecode-text)] whitespace-pre-line">{comment.content}</p>
                        {comment.resolved && (
                          <Badge variant="secondary" className="mt-3 text-[10px] inline-flex items-center">
                            <MessageSquareReply className="h-3 w-3 mr-1" />
                            Marked as resolved
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="border-t border-border/60 p-4 bg-muted/30">
                  <Textarea
                    value={newReply}
                    onChange={(event) => setNewReply(event.target.value)}
                    placeholder="Add a reply for your teammates"
                    className="min-h-[100px]"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground">
                      Project ID: {projectId}
                    </div>
                    <Button size="sm" disabled={!newReply.trim()} onClick={() => setNewReply('')}>
                      <Send className="h-4 w-4 mr-1" />
                      Comment
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <MessageSquareText className="h-12 w-12 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-[15px]">No thread selected</h3>
                <p className="text-[13px] text-muted-foreground mt-1">
                  Choose a thread on the left or start a new discussion.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
