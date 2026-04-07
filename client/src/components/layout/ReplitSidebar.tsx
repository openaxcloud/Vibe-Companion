import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Search,
  Settings,
  GitBranch,
  Terminal,
  Play,
  Square,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Database,
  Globe,
  Lock,
  Users,
  Star,
  Clock,
  Tag,
  Sparkles,
  Package,
  HardDrive,
  Key,
  Rocket,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface FileNode {
  id: number;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  isOpen?: boolean;
}

interface Project {
  id: number;
  name: string;
  language: string;
  visibility: "public" | "private" | "unlisted";
  lastModified: string;
  isRunning?: boolean;
  isStarred?: boolean;
}

export function ReplitSidebar({ projectId }: { projectId?: number }) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["/"]));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: files = [], isLoading: filesLoading } = useQuery<FileNode[]>({
    queryKey: [`/api/projects/${projectId}/files`],
    enabled: !!projectId,
  });

  const { data: recentProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (files: FileNode[], level = 0) => {
    return files.map((file) => (
      <div key={file.id} className="select-none">
        <div
          className={`flex items-center py-1 px-2 rounded-md cursor-pointer replit-transition group ${
            selectedFile === file.path
              ? "bg-[var(--ecode-accent)] text-white"
              : "text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => {
            if (file.type === "folder") {
              toggleFolder(file.path);
            } else {
              setSelectedFile(file.path);
            }
          }}
        >
          {file.type === "folder" ? (
            <>
              {expandedFolders.has(file.path) ? (
                <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
              )}
              {expandedFolders.has(file.path) ? (
                <FolderOpen className="h-4 w-4 mr-2 flex-shrink-0 text-[var(--ecode-blue)]" />
              ) : (
                <Folder className="h-4 w-4 mr-2 flex-shrink-0 text-[var(--ecode-blue)]" />
              )}
            </>
          ) : (
            <FileText className="h-4 w-4 mr-2 ml-5 flex-shrink-0 text-[var(--ecode-text-secondary)]" />
          )}
          <span className="truncate text-[13px]">{file.name}</span>
        </div>
        {file.type === "folder" && expandedFolders.has(file.path) && file.children && (
          <div>
            {renderFileTree(file.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  return (
    <TooltipProvider>
      <div className="w-60 bg-[var(--ecode-surface)] border-r border-[var(--ecode-border)] flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {projectId && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                  >
                    <div className="flex items-center">
                      <Folder className="h-4 w-4 mr-2" />
                      <span className="text-[13px] font-medium">Files</span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="New File"
                            className="h-6 w-6 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>New File</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Search Files"
                            className="h-6 w-6 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                          >
                            <Search className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Search Files</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Refresh files"
                            className="h-6 w-6 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Refresh</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {filesLoading ? (
                    <div className="text-center py-4">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto text-[var(--ecode-text-secondary)]" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {renderFileTree(files)}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                >
                  <div className="flex items-center">
                    <GitBranch className="h-4 w-4 mr-2" />
                    <span className="text-[13px] font-medium">Version Control</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                <div className="px-2 space-y-1">
                  <div className="text-[11px] text-[var(--ecode-text-secondary)]">main</div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                    >
                      Commit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                    >
                      Push
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {projectId && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                  >
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 mr-2" />
                      <span className="text-[13px] font-medium">Agent</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2">
                  <div className="px-2 py-2 text-[11px] text-[var(--ecode-text-secondary)]">
                    AI-powered assistant to help you build faster
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                    onClick={() => window.dispatchEvent(new CustomEvent('openAgent'))}
                  >
                    <Sparkles className="h-3 w-3 mr-2" />
                    Open Agent Chat
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                >
                  <div className="flex items-center">
                    <Terminal className="h-4 w-4 mr-2" />
                    <span className="text-[13px] font-medium">Tools</span>
                  </div>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openBottomPanelTab', { detail: { tab: 'console' } }))}
                >
                  <Terminal className="h-3 w-3 mr-2" />
                  Console
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openBottomPanelTab', { detail: { tab: 'terminal' } }))}
                >
                  <Terminal className="h-3 w-3 mr-2" />
                  Shell
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openRightPanelTab', { detail: { tab: 'postgres' } }))}
                >
                  <Database className="h-3 w-3 mr-2" />
                  Database
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openRightPanelTab', { detail: { tab: 'preview' } }))}
                >
                  <Globe className="h-3 w-3 mr-2" />
                  Webview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openRightPanelTab', { detail: { tab: 'packages' } }))}
                >
                  <Package className="h-3 w-3 mr-2" />
                  Packager
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openRightPanelTab', { detail: { tab: 'storage' } }))}
                >
                  <HardDrive className="h-3 w-3 mr-2" />
                  Object Storage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                  onClick={() => window.dispatchEvent(new CustomEvent('openBottomPanelTab', { detail: { tab: 'secrets' } }))}
                >
                  <Key className="h-3 w-3 mr-2" />
                  Secrets
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {!projectId && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                  >
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span className="text-[13px] font-medium">Recent</span>
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2">
                  {recentProjects.slice(0, 5).map((project) => (
                    <Link key={project.id} href={`/ide/${project.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--ecode-sidebar-hover)] cursor-pointer group replit-transition">
                        <div className="flex items-center min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            {project.visibility === "private" ? (
                              <Lock className="h-3 w-3 text-[var(--ecode-text-secondary)]" />
                            ) : project.visibility === "public" ? (
                              <Globe className="h-3 w-3 text-[var(--ecode-green)]" />
                            ) : (
                              <Users className="h-3 w-3 text-[var(--ecode-orange)]" />
                            )}
                          </div>
                          <div className="ml-2 min-w-0 flex-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-[13px] text-[var(--ecode-text)] truncate">
                                {project.name}
                              </span>
                              {project.isStarred && (
                                <Star className="h-3 w-3 text-[var(--ecode-warning)] fill-current" />
                              )}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge
                                variant="outline"
                                className="text-[11px] border-[var(--ecode-border)] text-[var(--ecode-text-secondary)]"
                              >
                                {project.language}
                              </Badge>
                              {project.isRunning && (
                                <div className="flex items-center">
                                  <div className="h-2 w-2 bg-[var(--ecode-green)] rounded-full animate-pulse"></div>
                                  <span className="text-[11px] text-[var(--ecode-green)] ml-1">Running</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={project.isRunning ? "Stop project" : "Run project"}
                            className="h-6 w-6 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)]"
                          >
                            {project.isRunning ? (
                              <Square className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Play className="h-3 w-3" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {projectId && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] p-2 h-auto"
                  >
                    <div className="flex items-center">
                      <Rocket className="h-4 w-4 mr-2" />
                      <span className="text-[13px] font-medium">Deploy</span>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 mt-2">
                  <div className="px-2 py-2 text-[11px] text-[var(--ecode-text-secondary)]">
                    Deploy your project to the web.
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] h-8"
                    onClick={() => window.dispatchEvent(new CustomEvent('openDeploy'))}
                  >
                    <Rocket className="h-3 w-3 mr-2" />
                    Open Deploy
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}

          </div>
        </ScrollArea>

        <div className="p-3 border-t border-[var(--ecode-border)]">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              className="h-8 w-8 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>

            {projectId && (
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Run project"
                  className="h-8 w-8 text-[var(--ecode-green)] hover:bg-surface-hover-solid"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Stop project"
                  className="h-8 w-8 text-[var(--ecode-text-secondary)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                >
                  <Square className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
