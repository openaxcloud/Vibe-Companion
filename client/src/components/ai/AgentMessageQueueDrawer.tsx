import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, GripVertical, Trash2, Pencil, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface QueueItem {
  id: string;
  content: string;
  attachments?: Array<{ name: string; type: string; size: number }>;
}

interface AgentMessageQueueDrawerProps {
  items: QueueItem[];
  onReorder: (items: QueueItem[]) => void;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function AgentMessageQueueDrawer({
  items,
  onReorder,
  onEdit,
  onDelete,
  onClearAll,
  isOpen,
  onOpenChange,
  className,
}: AgentMessageQueueDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [editingId]);

  const handleStartEdit = useCallback((item: QueueItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editContent.trim()) {
      onEdit(editingId, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  }, [editingId, editContent, onEdit]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }, [handleSaveEdit, handleCancelEdit]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, removed);
    onReorder(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, items, onReorder]);

  if (items.length === 0) return null;

  return (
    <div className={cn(
      "border border-border/60 rounded-lg bg-card/95 backdrop-blur-sm overflow-hidden",
      className
    )}>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => onOpenChange(!isOpen)}
        data-testid="queue-header-toggle"
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            !isOpen && "-rotate-90"
          )} />
          <span className="text-[13px] font-medium text-foreground">Queue</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-[12px]">
                Messages will be processed in order after Agent finishes its current task.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onClearAll();
          }}
          data-testid="button-clear-queue"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {isOpen && (
        <div className="px-3 pb-3 space-y-1.5" data-testid="container-queue-items">
          {items.map((item, index) => (
            <div
              key={item.id}
              draggable={editingId !== item.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={cn(
                "group flex items-start gap-1.5 rounded-md border border-border/50 bg-muted/30 px-2 py-2 transition-all",
                dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && "border-primary/60 bg-primary/5",
                editingId === item.id && "border-primary/50 bg-background"
              )}
              data-testid={`queue-item-${item.id}`}
            >
              <div
                className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                data-testid={`drag-handle-${item.id}`}
              >
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Textarea
                      ref={editTextareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      className="min-h-[36px] text-[13px] resize-none bg-background border-border/60"
                      rows={2}
                      data-testid={`edit-textarea-${item.id}`}
                    />
                  </div>
                ) : (
                  <p
                    className="text-[13px] text-foreground/80 leading-snug line-clamp-2 cursor-pointer"
                    onClick={() => handleStartEdit(item)}
                    data-testid={`queue-item-text-${item.id}`}
                  >
                    {item.content}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {editingId === item.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={handleCancelEdit}
                      data-testid={`button-cancel-edit-${item.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    {index === 0 && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground font-normal"
                      >
                        Next
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                      onClick={() => handleStartEdit(item)}
                      data-testid={`button-edit-${item.id}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      onClick={() => onDelete(item.id)}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId && (
        <div className="px-3 pb-3 border-t border-border/40">
          <div className="pt-2 text-[11px] text-muted-foreground mb-1.5">Editing queued message</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 text-muted-foreground text-[12px]">
              <span className="cursor-pointer hover:text-foreground">📎</span>
              <span className="cursor-pointer hover:text-foreground">⚙️ Edit</span>
              <span className="cursor-pointer hover:text-foreground">⊞</span>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                className="h-7 px-3 text-[12px] bg-primary hover:bg-primary/90"
                onClick={handleSaveEdit}
                data-testid="button-save-edit"
              >
                Save ✓
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
