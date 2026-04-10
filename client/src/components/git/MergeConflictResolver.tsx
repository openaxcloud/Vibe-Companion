/**
 * Merge Conflict Resolver - Interactive conflict resolution
 * Apple-grade UX for resolving git merge conflicts
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  GitMerge,
  Users,
  ArrowLeftRight,
  Copy,
  Undo,
  Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ConflictBlock {
  id: string;
  startLine: number;
  endLine: number;
  currentContent: string;
  incomingContent: string;
  baseContent?: string; // For 3-way merge
  resolution: 'current' | 'incoming' | 'both' | 'manual' | null;
  manualContent?: string;
}

interface ConflictFile {
  path: string;
  conflicts: ConflictBlock[];
  currentBranch: string;
  incomingBranch: string;
}

interface MergeConflictResolverProps {
  files: ConflictFile[];
  onResolve: (filePath: string, resolutions: ConflictBlock[]) => void;
  onCancel?: () => void;
  className?: string;
}

export function MergeConflictResolver({
  files,
  onResolve,
  onCancel,
  className
}: MergeConflictResolverProps) {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentConflictIndex, setCurrentConflictIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Map<string, ConflictBlock[]>>(new Map());
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const { toast } = useToast();

  const currentFile = files[currentFileIndex];
  const currentConflict = currentFile?.conflicts[currentConflictIndex];
  const totalConflicts = files.reduce((sum, file) => sum + file.conflicts.length, 0);
  const resolvedConflicts = Array.from(resolutions.values())
    .flatMap(blocks => blocks)
    .filter(block => block.resolution !== null).length;

  // Initialize resolutions map
  useEffect(() => {
    const initialResolutions = new Map<string, ConflictBlock[]>();
    files.forEach(file => {
      initialResolutions.set(file.path, [...file.conflicts]);
    });
    setResolutions(initialResolutions);
  }, [files]);

  const updateResolution = (
    resolution: 'current' | 'incoming' | 'both' | 'manual',
    manualContent?: string
  ) => {
    const updatedBlocks = resolutions.get(currentFile.path)?.map(block =>
      block.id === currentConflict.id
        ? { ...block, resolution, manualContent }
        : block
    );

    if (updatedBlocks) {
      const newResolutions = new Map(resolutions);
      newResolutions.set(currentFile.path, updatedBlocks);
      setResolutions(newResolutions);

      toast({
        title: "Resolution applied",
        description: `Conflict resolved using ${resolution} version`,
      });

      // Auto-advance to next conflict
      navigateConflict('next');
    }
  };

  const navigateConflict = (direction: 'next' | 'previous') => {
    if (direction === 'next') {
      if (currentConflictIndex < currentFile.conflicts.length - 1) {
        setCurrentConflictIndex(currentConflictIndex + 1);
      } else if (currentFileIndex < files.length - 1) {
        setCurrentFileIndex(currentFileIndex + 1);
        setCurrentConflictIndex(0);
      }
    } else {
      if (currentConflictIndex > 0) {
        setCurrentConflictIndex(currentConflictIndex - 1);
      } else if (currentFileIndex > 0) {
        setCurrentFileIndex(currentFileIndex - 1);
        const prevFile = files[currentFileIndex - 1];
        setCurrentConflictIndex(prevFile.conflicts.length - 1);
      }
    }

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
  };

  const handleResolveAll = () => {
    if (resolvedConflicts < totalConflicts) {
      toast({
        title: "Incomplete resolutions",
        description: `${totalConflicts - resolvedConflicts} conflicts still need resolution`,
        variant: "destructive",
      });
      return;
    }

    files.forEach(file => {
      const fileResolutions = resolutions.get(file.path);
      if (fileResolutions) {
        onResolve(file.path, fileResolutions);
      }
    });

    toast({
      title: "All conflicts resolved",
      description: `${totalConflicts} conflicts have been resolved successfully`,
    });
  };

  const resetResolution = () => {
    const updatedBlocks = resolutions.get(currentFile.path)?.map(block =>
      block.id === currentConflict.id
        ? { ...block, resolution: null, manualContent: undefined }
        : block
    );

    if (updatedBlocks) {
      const newResolutions = new Map(resolutions);
      newResolutions.set(currentFile.path, updatedBlocks);
      setResolutions(newResolutions);
    }
  };

  const getResolutionBadge = (resolution: ConflictBlock['resolution']) => {
    if (!resolution) return null;

    const variants = {
      current: { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', label: 'Current' },
      incoming: { color: 'bg-green-500/10 text-green-600 border-green-500/20', label: 'Incoming' },
      both: { color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', label: 'Both' },
      manual: { color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', label: 'Manual' },
    };

    const variant = variants[resolution];
    return (
      <Badge variant="outline" className={cn("text-[11px]", variant.color)}>
        {variant.label}
      </Badge>
    );
  };

  if (!currentFile || !currentConflict) {
    return (
      <Card className={cn("h-full flex items-center justify-center", className)}>
        <div className="text-center text-muted-foreground">
          <GitMerge className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No conflicts to resolve</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            Merge Conflicts
          </CardTitle>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px]">
              {resolvedConflicts}/{totalConflicts} resolved
            </Badge>
            {getResolutionBadge(currentConflict.resolution)}
          </div>
        </div>

        <Separator className="my-3" />

        {/* File and conflict navigation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">File:</span>
              <code className="px-2 py-0.5 rounded bg-muted font-mono">
                {currentFile.path}
              </code>
              <Badge variant="outline" className="text-[10px]">
                {currentFile.conflicts.length} conflicts
              </Badge>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => navigateConflict('previous')}
                disabled={currentFileIndex === 0 && currentConflictIndex === 0}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="px-2">
                Conflict {currentConflictIndex + 1}/{currentFile.conflicts.length}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2"
                onClick={() => navigateConflict('next')}
                disabled={
                  currentFileIndex === files.length - 1 &&
                  currentConflictIndex === currentFile.conflicts.length - 1
                }
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span>{currentFile.currentBranch}</span>
            </div>
            <ArrowLeftRight className="h-3 w-3" />
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>{currentFile.incomingBranch}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Quick action buttons */}
        <div className="px-4 py-2 flex items-center gap-2 border-b bg-muted/30">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] text-blue-600 border-blue-600/20 hover:bg-blue-500/10"
            onClick={() => updateResolution('current')}
          >
            Accept Current
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] text-green-600 border-green-600/20 hover:bg-green-500/10"
            onClick={() => updateResolution('incoming')}
          >
            Accept Incoming
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] text-purple-600 border-purple-600/20 hover:bg-purple-500/10"
            onClick={() => updateResolution('both')}
          >
            Accept Both
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            onClick={resetResolution}
            disabled={!currentConflict.resolution}
          >
            <Undo className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>

        {/* Conflict view */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="split">Split View</TabsTrigger>
                <TabsTrigger value="unified">Unified View</TabsTrigger>
              </TabsList>

              <TabsContent value="split" className="mt-0">
                <div className="grid grid-cols-2 gap-4">
                  {/* Current (ours) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <span className="text-[13px] font-medium">
                        Current ({currentFile.currentBranch})
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap">
                        {currentConflict.currentContent}
                      </pre>
                    </div>
                  </div>

                  {/* Incoming (theirs) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500" />
                      <span className="text-[13px] font-medium">
                        Incoming ({currentFile.incomingBranch})
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap">
                        {currentConflict.incomingContent}
                      </pre>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="unified" className="mt-0">
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="text-[11px] font-mono text-red-600 mb-2">
                      {'<<<<<<< '}Current ({currentFile.currentBranch})
                    </div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap mb-2">
                      {currentConflict.currentContent}
                    </pre>
                    <div className="text-[11px] font-mono text-yellow-600 my-2">=======</div>
                    <pre className="text-[11px] font-mono whitespace-pre-wrap mb-2">
                      {currentConflict.incomingContent}
                    </pre>
                    <div className="text-[11px] font-mono text-green-600">
                      {'>>>>>>> '}Incoming ({currentFile.incomingBranch})
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Resolution preview */}
            {currentConflict.resolution && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium">Resolution Preview</span>
                  {getResolutionBadge(currentConflict.resolution)}
                </div>
                <div className="p-3 rounded-lg bg-[var(--ecode-orange)]/5 border border-[var(--ecode-orange)]/20">
                  <pre className="text-[11px] font-mono whitespace-pre-wrap">
                    {currentConflict.resolution === 'current' && currentConflict.currentContent}
                    {currentConflict.resolution === 'incoming' && currentConflict.incomingContent}
                    {currentConflict.resolution === 'both' &&
                      `${currentConflict.currentContent}\n${currentConflict.incomingContent}`}
                    {currentConflict.resolution === 'manual' && currentConflict.manualContent}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom actions */}
        <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/30">
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
          >
            Cancel Merge
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {resolvedConflicts}/{totalConflicts} conflicts resolved
            </span>
            <Button
              size="sm"
              onClick={handleResolveAll}
              disabled={resolvedConflicts < totalConflicts}
              className="bg-[var(--ecode-orange)] hover:bg-[var(--ecode-orange-hover)]"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Complete Merge
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
