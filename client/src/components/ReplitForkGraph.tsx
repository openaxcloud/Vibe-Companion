import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  GitPullRequest,
  Users,
  Star,
  Eye,
  ChevronRight,
  Maximize2,
  Minimize2,
  Download
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Fork {
  id: string;
  projectId: number;
  parentId?: string;
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  name: string;
  description?: string;
  stars: number;
  views: number;
  forkedAt: Date;
  lastCommit?: {
    message: string;
    author: string;
    date: Date;
  };
  children?: Fork[];
  x?: number;
  y?: number;
}

interface ForkGraphProps {
  projectId: number;
  className?: string;
}

export function ReplitForkGraph({ projectId, className }: ForkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedFork, setSelectedFork] = useState<Fork | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const { data: forkNetwork } = useQuery<Fork>({
    queryKey: [`/api/forks/${projectId}/network`]
  });

  useEffect(() => {
    if (!canvasRef.current || !forkNetwork) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const nodeRadius = 30;
    const levelHeight = 100;
    const nodeSpacing = 120;

    const positionNodes = (node: Fork, x: number, y: number, level: number) => {
      node.x = x;
      node.y = y;

      if (node.children && node.children.length > 0) {
        const totalWidth = (node.children.length - 1) * nodeSpacing;
        const startX = x - totalWidth / 2;

        node.children.forEach((child, index) => {
          positionNodes(child, startX + index * nodeSpacing, y + levelHeight, level + 1);
        });
      }
    };

    positionNodes(forkNetwork, canvas.width / 2, 50, 0);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const drawConnections = (node: Fork) => {
      if (node.children) {
        node.children.forEach(child => {
          if (node.x && node.y && child.x && child.y) {
            ctx.beginPath();
            ctx.strokeStyle = 'hsl(var(--border))';
            ctx.lineWidth = 2;
            ctx.moveTo(node.x, node.y + nodeRadius);
            ctx.bezierCurveTo(
              node.x, node.y + nodeRadius + 30,
              child.x, child.y - 30,
              child.x, child.y - nodeRadius
            );
            ctx.stroke();
            drawConnections(child);
          }
        });
      }
    };

    drawConnections(forkNetwork);

    const drawNode = (node: Fork) => {
      if (!node.x || !node.y) return;

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = node.id === projectId.toString() ? 'hsl(var(--primary))' : 'hsl(var(--card))';
      ctx.fill();
      ctx.strokeStyle = 'hsl(var(--border))';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius - 5, 0, 2 * Math.PI);
      ctx.clip();
      
      ctx.fillStyle = 'hsl(var(--foreground))';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.owner.username[0].toUpperCase(), node.x, node.y);
      ctx.restore();

      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.owner.username, node.x, node.y + nodeRadius + 15);

      if (node.children) {
        node.children.forEach(drawNode);
      }
    };

    drawNode(forkNetwork);
    ctx.restore();
  }, [forkNetwork, zoom, pan]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !forkNetwork) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const findClickedNode = (node: Fork): Fork | null => {
      if (node.x && node.y) {
        const distance = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
        if (distance <= 30) return node;
      }
      
      if (node.children) {
        for (const child of node.children) {
          const found = findClickedNode(child);
          if (found) return found;
        }
      }
      
      return null;
    };

    const clicked = findClickedNode(forkNetwork);
    if (clicked) {
      setSelectedFork(clicked);
    }
  };

  return (
    <TooltipProvider>
      <Card className={cn("relative", className, isFullscreen && "fixed inset-0 z-50")}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Fork Network
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Badge variant="secondary">{Math.round(zoom * 100)}%</Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full cursor-move bg-background"
              onClick={handleCanvasClick}
              onMouseDown={(e) => {
                const startX = e.clientX - pan.x;
                const startY = e.clientY - pan.y;
                
                const handleMouseMove = (e: MouseEvent) => {
                  setPan({
                    x: e.clientX - startX,
                    y: e.clientY - startY
                  });
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
            
            {selectedFork && (
              <div className="absolute top-4 right-4 w-80 bg-background border rounded-lg shadow-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedFork.owner.avatarUrl} />
                      <AvatarFallback>{selectedFork.owner.username[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{selectedFork.name}</h3>
                      <p className="text-[13px] text-muted-foreground">@{selectedFork.owner.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedFork(null)}
                  >
                    ×
                  </Button>
                </div>

                {selectedFork.description && (
                  <p className="text-[13px] text-muted-foreground mb-4">{selectedFork.description}</p>
                )}

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4" />
                    <span className="text-[13px]">{selectedFork.stars}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-[13px]">{selectedFork.views}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    <span className="text-[13px]">{selectedFork.children?.length || 0} forks</span>
                  </div>
                </div>

                {selectedFork.lastCommit && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <GitCommit className="h-4 w-4" />
                      <span className="text-[13px] font-medium">Last commit</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground">{selectedFork.lastCommit.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      by {selectedFork.lastCommit.author} • {new Date(selectedFork.lastCommit.date).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <Button className="w-full mt-4" size="sm">
                  <ChevronRight className="h-4 w-4 mr-2" />
                  View Fork
                </Button>
              </div>
            )}
          </div>

          <div className="p-4 border-t">
            <div className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Original</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-card border border-border" />
                  <span className="text-muted-foreground">Fork</span>
                </div>
              </div>
              <p className="text-muted-foreground">
                Click on a node to view details
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
