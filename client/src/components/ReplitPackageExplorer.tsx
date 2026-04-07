import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Package,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  TrendingUp,
  Download,
  Loader2,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  size?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  downloads?: number;
  lastPublish?: Date;
  vulnerabilities?: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
  };
}

interface PackageNode {
  name: string;
  version: string;
  depth: number;
  dependencies: PackageNode[];
  x?: number;
  y?: number;
  expanded?: boolean;
}

interface PackageExplorerProps {
  projectId: number;
  className?: string;
}

export function ReplitPackageExplorer({ projectId, className }: PackageExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedPackage, setSelectedPackage] = useState<PackageInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const { toast } = useToast();

  // Fetch installed packages
  const { data: installedPackages = {} } = useQuery<Record<string, PackageInfo>>({
    queryKey: [`/api/packages/${projectId}`]
  });

  // Fetch package tree
  const { data: packageTree } = useQuery<PackageNode>({
    queryKey: [`/api/packages/${projectId}/tree`]
  });

  // Search packages
  const { data: searchResults = [], isLoading: searchLoading } = useQuery<PackageInfo[]>({
    queryKey: [`/api/packages/search`, searchQuery],
    enabled: searchQuery.length > 2
  });

  // Install package mutation
  const installMutation = useMutation({
    mutationFn: async (packageName: string) => {
      return apiRequest('POST', `/api/packages/${projectId}`, {
        package: packageName
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/packages/${projectId}`] });
      toast({
        title: 'Package installed',
        description: 'Package has been installed successfully'
      });
    }
  });

  // Uninstall package mutation
  const uninstallMutation = useMutation({
    mutationFn: async (packageName: string) => {
      return apiRequest('DELETE', `/api/packages/${projectId}/${packageName}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/packages/${projectId}`] });
      toast({
        title: 'Package uninstalled',
        description: 'Package has been uninstalled successfully'
      });
    }
  });

  // Draw dependency tree
  useEffect(() => {
    if (!canvasRef.current || !packageTree) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Node dimensions
    const nodeWidth = 200;
    const nodeHeight = 60;
    const levelSpacing = 120;
    const nodeSpacing = 80;

    // Position nodes
    const positionNodes = (node: PackageNode, x: number, y: number, level: number) => {
      node.x = x;
      node.y = y;

      if (node.dependencies.length > 0 && expandedNodes.has(node.name)) {
        const totalWidth = (node.dependencies.length - 1) * (nodeWidth + nodeSpacing);
        const startX = x - totalWidth / 2;

        node.dependencies.forEach((dep, index) => {
          positionNodes(
            dep,
            startX + index * (nodeWidth + nodeSpacing),
            y + levelSpacing,
            level + 1
          );
        });
      }
    };

    positionNodes(packageTree, canvas.width / 2, 50, 0);

    // Apply transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw connections
    const drawConnections = (node: PackageNode) => {
      if (node.dependencies.length > 0 && expandedNodes.has(node.name) && node.x && node.y) {
        node.dependencies.forEach(dep => {
          if (dep.x && dep.y) {
            ctx.beginPath();
            ctx.strokeStyle = '#4b5563';
            ctx.lineWidth = 1;
            ctx.moveTo(node.x!, node.y! + nodeHeight / 2);
            ctx.lineTo(dep.x, dep.y - nodeHeight / 2);
            ctx.stroke();
          }
        });

        node.dependencies.forEach(drawConnections);
      }
    };

    drawConnections(packageTree);

    // Draw nodes
    const drawNode = (node: PackageNode) => {
      if (!node.x || !node.y) return;

      // Node background
      ctx.fillStyle = '#1f2937';
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(node.x - nodeWidth / 2, node.y - nodeHeight / 2, nodeWidth, nodeHeight, 8);
      ctx.fill();
      ctx.stroke();

      // Package icon
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(node.x - nodeWidth / 2 + 10, node.y - 15, 30, 30, 4);
      ctx.fill();

      // Package name
      ctx.fillStyle = '#e5e7eb';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(node.name, node.x - nodeWidth / 2 + 50, node.y - 5);

      // Version
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px sans-serif';
      ctx.fillText(node.version, node.x - nodeWidth / 2 + 50, node.y + 10);

      // Expand/collapse indicator
      if (node.dependencies.length > 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          expandedNodes.has(node.name) ? '−' : '+',
          node.x + nodeWidth / 2 - 20,
          node.y + 5
        );
      }

      if (expandedNodes.has(node.name)) {
        node.dependencies.forEach(drawNode);
      }
    };

    drawNode(packageTree);
    ctx.restore();
  }, [packageTree, expandedNodes, zoom, pan]);

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !packageTree) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    // Find clicked node
    const findClickedNode = (node: PackageNode): PackageNode | null => {
      if (node.x && node.y) {
        const nodeWidth = 200;
        const nodeHeight = 60;
        
        if (
          x >= node.x - nodeWidth / 2 &&
          x <= node.x + nodeWidth / 2 &&
          y >= node.y - nodeHeight / 2 &&
          y <= node.y + nodeHeight / 2
        ) {
          return node;
        }
      }

      if (expandedNodes.has(node.name) && node.dependencies) {
        for (const dep of node.dependencies) {
          const found = findClickedNode(dep);
          if (found) return found;
        }
      }

      return null;
    };

    const clicked = findClickedNode(packageTree);
    if (clicked) {
      // Toggle expansion
      const newExpanded = new Set(expandedNodes);
      if (newExpanded.has(clicked.name)) {
        newExpanded.delete(clicked.name);
      } else {
        newExpanded.add(clicked.name);
      }
      setExpandedNodes(newExpanded);

      // Load package details
      if (installedPackages[clicked.name]) {
        setSelectedPackage(installedPackages[clicked.name]);
      }
    }
  };

  const getVulnerabilityColor = (vulnerabilities?: PackageInfo['vulnerabilities']) => {
    if (!vulnerabilities) return 'text-muted-foreground';
    if (vulnerabilities.critical > 0) return 'text-red-500';
    if (vulnerabilities.high > 0) return 'text-orange-500';
    if (vulnerabilities.moderate > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <TooltipProvider>
      <Card className={cn("h-full flex flex-col", className, isFullscreen && "fixed inset-0 z-50")}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Package Explorer
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
          </div>
        </CardHeader>

        <Tabs defaultValue="tree" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tree">Dependency Tree</TabsTrigger>
            <TabsTrigger value="installed">
              Installed
              <Badge variant="secondary" className="ml-2">
                {Object.keys(installedPackages).length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="tree" className="flex-1 mt-0">
            <div className="relative h-full">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="w-full h-full cursor-move bg-card"
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

              {selectedPackage && (
                <div className="absolute top-4 right-4 w-80 bg-background border rounded-lg shadow-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{selectedPackage.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedPackage(null)}
                    >
                      ×
                    </Button>
                  </div>
                  <p className="text-[13px] text-muted-foreground mb-2">{selectedPackage.version}</p>
                  {selectedPackage.description && (
                    <p className="text-[13px] mb-3">{selectedPackage.description}</p>
                  )}
                  <div className="space-y-2 text-[13px]">
                    {selectedPackage.size && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{selectedPackage.size}</span>
                      </div>
                    )}
                    {selectedPackage.license && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License:</span>
                        <span>{selectedPackage.license}</span>
                      </div>
                    )}
                    {selectedPackage.vulnerabilities && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Security:</span>
                        <span className={getVulnerabilityColor(selectedPackage.vulnerabilities)}>
                          {selectedPackage.vulnerabilities.critical + 
                           selectedPackage.vulnerabilities.high + 
                           selectedPackage.vulnerabilities.moderate + 
                           selectedPackage.vulnerabilities.low === 0
                            ? 'No issues'
                            : `${selectedPackage.vulnerabilities.critical} critical, ${selectedPackage.vulnerabilities.high} high`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="installed" className="flex-1 mt-0">
            <CardContent className="h-full p-4">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {Object.entries(installedPackages).map(([name, pkg]) => (
                    <div
                      key={name}
                      className="p-3 rounded-md border hover:bg-muted cursor-pointer"
                      onClick={() => setSelectedPackage(pkg)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{name}</span>
                            <Badge variant="secondary" className="text-[11px]">{pkg.version}</Badge>
                          </div>
                          {pkg.description && (
                            <p className="text-[13px] text-muted-foreground mt-1 line-clamp-1">
                              {pkg.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {pkg.vulnerabilities && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className={cn("h-4 w-4", getVulnerabilityColor(pkg.vulnerabilities))} />
                              </TooltipTrigger>
                              <TooltipContent>
                                {pkg.vulnerabilities.critical} critical, {pkg.vulnerabilities.high} high vulnerabilities
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              uninstallMutation.mutate(name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>

          <TabsContent value="search" className="flex-1 mt-0">
            <CardContent className="h-full p-4 flex flex-col">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    searchResults.map((pkg) => (
                      <div key={pkg.name} className="p-3 rounded-md border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-blue-500" />
                              <span className="font-medium">{pkg.name}</span>
                              <Badge variant="secondary" className="text-[11px]">{pkg.version}</Badge>
                            </div>
                            {pkg.description && (
                              <p className="text-[13px] text-muted-foreground mt-1">
                                {pkg.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                              {pkg.downloads && (
                                <div className="flex items-center gap-1">
                                  <Download className="h-3 w-3" />
                                  <span>{pkg.downloads.toLocaleString()}/week</span>
                                </div>
                              )}
                              {pkg.license && <span>{pkg.license}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => installMutation.mutate(pkg.name)}
                            disabled={installedPackages[pkg.name] !== undefined || installMutation.isPending}
                          >
                            {installedPackages[pkg.name] ? (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Installed
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-2" />
                                Install
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </TooltipProvider>
  );
}