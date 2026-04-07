import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare,
  Reply,
  Heart,
  MoreVertical,
  Check,
  X,
  Edit2,
  Trash2,
  Code,
  AlertCircle,
  Bug,
  Lightbulb,
  Zap,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  text: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: Date;
  line?: number;
  file?: string;
  type: 'comment' | 'suggestion' | 'issue' | 'bug';
  resolved?: boolean;
  likes: number;
  replies: Comment[];
  codeSnippet?: string;
}

interface CommentsPanelProps {
  fileId?: number;
  projectId: number;
  className?: string;
}

export function CommentsPanel({ fileId, projectId, className }: CommentsPanelProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      text: 'This function could be optimized using memoization to improve performance.',
      author: {
        id: '1',
        name: 'Alice Chen',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
      },
      timestamp: new Date(Date.now() - 3600000),
      line: 42,
      file: 'src/utils/helpers.ts',
      type: 'suggestion',
      likes: 3,
      replies: [
        {
          id: '2',
          text: 'Good point! I implemented useMemo here in the latest commit.',
          author: {
            id: '2',
            name: 'Bob Smith',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
          },
          timestamp: new Date(Date.now() - 1800000),
          type: 'comment',
          likes: 1,
          replies: [],
        },
      ],
      codeSnippet: `const result = expensiveCalculation(data);
// Could use useMemo here`,
    },
    {
      id: '3',
      text: 'Missing error handling for API calls. This could cause unhandled promise rejections.',
      author: {
        id: '3',
        name: 'Carol Davis',
      },
      timestamp: new Date(Date.now() - 7200000),
      line: 78,
      file: 'src/api/client.ts',
      type: 'issue',
      likes: 5,
      replies: [],
      codeSnippet: 'await fetch(url).then(res => res.json())',
    },
  ]);

  const [newComment, setNewComment] = useState('');
  const [selectedType, setSelectedType] = useState<Comment['type']>('comment');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const getTypeIcon = (type: Comment['type']) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-3.5 w-3.5" />;
      case 'suggestion':
        return <Lightbulb className="h-3.5 w-3.5" />;
      case 'issue':
        return <AlertCircle className="h-3.5 w-3.5" />;
      case 'bug':
        return <Bug className="h-3.5 w-3.5" />;
    }
  };

  const getTypeColor = (type: Comment['type']) => {
    switch (type) {
      case 'comment':
        return 'default';
      case 'suggestion':
        return 'secondary';
      case 'issue':
        return 'destructive';
      case 'bug':
        return 'destructive';
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment,
      author: {
        id: 'current',
        name: 'You',
      },
      timestamp: new Date(),
      type: selectedType,
      likes: 0,
      replies: [],
    };

    setComments([comment, ...comments]);
    setNewComment('');
    toast({
      title: "Comment added",
      description: "Your comment has been posted",
    });
  };

  const handleReply = (commentId: string, replyText: string) => {
    if (!replyText.trim()) return;

    const reply: Comment = {
      id: Date.now().toString(),
      text: replyText,
      author: {
        id: 'current',
        name: 'You',
      },
      timestamp: new Date(),
      type: 'comment',
      likes: 0,
      replies: [],
    };

    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          replies: [...comment.replies, reply],
        };
      }
      return comment;
    }));

    setReplyingTo(null);
    toast({
      title: "Reply added",
      description: "Your reply has been posted",
    });
  };

  const handleLike = (commentId: string) => {
    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          likes: comment.likes + 1,
        };
      }
      return comment;
    }));
  };

  const handleResolve = (commentId: string) => {
    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          resolved: !comment.resolved,
        };
      }
      return comment;
    }));
  };

  const handleEdit = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setEditingComment(commentId);
      setEditText(comment.text);
    }
  };

  const handleSaveEdit = (commentId: string) => {
    setComments(comments.map(comment => {
      if (comment.id === commentId) {
        return {
          ...comment,
          text: editText,
        };
      }
      return comment;
    }));
    setEditingComment(null);
    setEditText('');
    toast({
      title: "Comment updated",
      description: "Your changes have been saved",
    });
  };

  const handleDelete = (commentId: string) => {
    setComments(comments.filter(comment => comment.id !== commentId));
    toast({
      title: "Comment deleted",
      description: "The comment has been removed",
    });
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments & Annotations
          <Badge variant="secondary" className="ml-1">
            {comments.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100%-12rem)]">
          <div className="p-4 space-y-4">
            {/* Add Comment */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={selectedType === 'comment' ? 'default' : 'outline'}
                  onClick={() => setSelectedType('comment')}
                >
                  {getTypeIcon('comment')}
                  Comment
                </Button>
                <Button
                  size="sm"
                  variant={selectedType === 'suggestion' ? 'default' : 'outline'}
                  onClick={() => setSelectedType('suggestion')}
                >
                  {getTypeIcon('suggestion')}
                  Suggestion
                </Button>
                <Button
                  size="sm"
                  variant={selectedType === 'issue' ? 'default' : 'outline'}
                  onClick={() => setSelectedType('issue')}
                >
                  {getTypeIcon('issue')}
                  Issue
                </Button>
                <Button
                  size="sm"
                  variant={selectedType === 'bug' ? 'default' : 'outline'}
                  onClick={() => setSelectedType('bug')}
                >
                  {getTypeIcon('bug')}
                  Bug
                </Button>
              </div>
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px]"
              />
              <Button onClick={handleAddComment} className="w-full">
                Post Comment
              </Button>
            </div>

            <Separator />

            {/* Comments List */}
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    comment.resolved && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.author.avatar} />
                      <AvatarFallback>
                        {comment.author.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium">
                            {comment.author.name}
                          </span>
                          <Badge variant={getTypeColor(comment.type)} className="text-[11px]">
                            {getTypeIcon(comment.type)}
                            {comment.type}
                          </Badge>
                          {comment.resolved && (
                            <Badge variant="outline" className="text-[11px]">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">
                            {formatTime(comment.timestamp)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(comment.id)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResolve(comment.id)}>
                                <Check className="h-4 w-4 mr-2" />
                                {comment.resolved ? 'Unresolve' : 'Resolve'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(comment.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {comment.file && (
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Code className="h-3 w-3" />
                          {comment.file}
                          {comment.line && ` • Line ${comment.line}`}
                        </div>
                      )}

                      {editingComment === comment.id ? (
                        <div className="space-y-2 mt-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="min-h-[60px]"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingComment(null);
                                setEditText('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-[13px]">{comment.text}</p>
                          {comment.codeSnippet && (
                            <pre className="text-[11px] bg-muted p-2 rounded mt-2 overflow-x-auto">
                              <code>{comment.codeSnippet}</code>
                            </pre>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => handleLike(comment.id)}
                        >
                          <Heart className="h-3 w-3 mr-1" />
                          {comment.likes}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setReplyingTo(comment.id)}
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </div>

                      {/* Replies */}
                      {comment.replies.length > 0 && (
                        <div className="ml-6 mt-3 space-y-2">
                          {comment.replies.map((reply) => (
                            <div key={reply.id} className="flex items-start gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={reply.author.avatar} />
                                <AvatarFallback className="text-[11px]">
                                  {reply.author.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium">
                                    {reply.author.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatTime(reply.timestamp)}
                                  </span>
                                </div>
                                <p className="text-[11px] mt-1">{reply.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Input */}
                      {replyingTo === comment.id && (
                        <div className="ml-6 mt-2 space-y-2">
                          <Textarea
                            placeholder="Write a reply..."
                            className="min-h-[60px]"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleReply(comment.id, e.currentTarget.value);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={(e) => {
                                const textarea = e.currentTarget.parentElement?.previousElementSibling as HTMLTextAreaElement;
                                if (textarea) {
                                  handleReply(comment.id, textarea.value);
                                }
                              }}
                            >
                              Reply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setReplyingTo(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}