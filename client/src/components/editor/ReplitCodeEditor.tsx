import { useState, useRef, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { CM6Editor } from '@/components/editor/CM6Editor';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, AlertCircle, RefreshCw, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { File } from '@shared/schema';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SkeletonText } from '@/components/ui/skeleton-loader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAIPreferences } from '@/hooks/use-ai-preferences';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MultiEditorManager } from './MultiEditorManager';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface EditorTab {
  fileId: number;
  fileName: string;
  content: string;
  language: string;
  isDirty: boolean;
  version: number;
  lastSavedContent?: string;
}

interface ReplitCodeEditorProps {
  files: File[];
  activeFile?: File;
  onFileUpdate: (fileId: number, content: string) => void;
  className?: string;
}

function getLanguageFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    r: 'r',
    m: 'matlab',
    lua: 'lua',
    sh: 'shell',
    bash: 'shell',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    gitignore: 'gitignore',
  };
  
  return languageMap[extension || ''] || 'plaintext';
}

interface SortableTabProps {
  tab: EditorTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

function SortableTab({ tab, isActive, onClick, onClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `tab-${tab.fileId}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group flex items-center h-full px-3 border-r border-border cursor-pointer hover:bg-accent select-none",
        isActive && "bg-background border-b-0",
        isDragging && "cursor-grabbing"
      )}
      onClick={onClick}
      data-testid={`editor-tab-${tab.fileId}`}
    >
      <span className="text-[13px] whitespace-nowrap font-[family-name:var(--ecode-font-sans)]">
        {tab.isDirty && <span className="text-primary mr-1">•</span>}
        {tab.fileName}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        data-testid={`close-tab-${tab.fileId}`}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function ReplitCodeEditor({ 
  files, 
  activeFile, 
  onFileUpdate,
  className 
}: ReplitCodeEditorProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const editorRef = useRef<EditorView | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<{ fileId: number; content: string; version: number } | null>(null);
  const fileVersionsRef = useRef<Map<number, number>>(new Map());
  
  const {
    preferences: aiPreferences,
    toggleEnabled: toggleAIEnabled,
    setModel: setAIModel,
    toggleAutoTrigger,
    setConfidenceThreshold,
    getAvailableModels,
  } = useAIPreferences();

  useEffect(() => {
    if (activeFile && !activeFile.isDirectory) {
      const existingTab = tabs.find(tab => tab.fileId === activeFile.id);
      
      if (existingTab) {
        setActiveTabId(activeFile.id);
      } else {
        const newTab: EditorTab = {
          fileId: activeFile.id,
          fileName: activeFile.name,
          content: activeFile.content || '',
          language: getLanguageFromFileName(activeFile.name),
          isDirty: false,
          version: 0,
          lastSavedContent: activeFile.content || '',
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(activeFile.id);
        fileVersionsRef.current.set(activeFile.id, 0);
      }
    }
  }, [activeFile]);

  useEffect(() => {
    const activeTab = tabs.find(tab => tab.fileId === activeTabId);
    if (activeTab) {
      setEditorContent(activeTab.content);
    } else {
      setEditorContent('');
    }
  }, [activeTabId, tabs]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || activeTabId === null) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    const currentVersion = fileVersionsRef.current.get(activeTabId) || 0;
    
    setTabs(prevTabs => prevTabs.map(tab => 
      tab.fileId === activeTabId 
        ? { ...tab, content: value, isDirty: true, version: currentVersion }
        : tab
    ));
    
    saveTimeoutRef.current = setTimeout(async () => {
      if (isSavingRef.current && pendingSaveRef.current?.fileId === activeTabId) {
        pendingSaveRef.current = { fileId: activeTabId, content: value, version: currentVersion };
        return;
      }
      
      isSavingRef.current = true;
      
      try {
        await onFileUpdate(activeTabId, value);
        
        const newVersion = currentVersion + 1;
        fileVersionsRef.current.set(activeTabId, newVersion);
        
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.fileId === activeTabId) {
            if (tab.content === value) {
              return { 
                ...tab, 
                isDirty: false, 
                version: newVersion,
                lastSavedContent: value 
              };
            }
          }
          return tab;
        }));
        
      } catch (error) {
        console.error('Failed to save file:', error);
        
        setTabs(prevTabs => prevTabs.map(tab => {
          if (tab.fileId === activeTabId && tab.content === value) {
            return {
              ...tab,
              content: tab.lastSavedContent || tab.content,
              isDirty: false,
              version: currentVersion
            };
          }
          return tab;
        }));
      } finally {
        isSavingRef.current = false;
        
        if (pendingSaveRef.current && pendingSaveRef.current.fileId === activeTabId) {
          const pending = pendingSaveRef.current;
          pendingSaveRef.current = null;
          handleEditorChange(pending.content);
        }
      }
    }, 1000);
  };

  const closeTab = (fileId: number) => {
    if (activeTabId === fileId && saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    fileVersionsRef.current.delete(fileId);
    
    const newTabs = tabs.filter(tab => tab.fileId !== fileId);
    setTabs(newTabs);
    
    if (activeTabId === fileId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].fileId : null);
    }
  };

  const handleEditorMount = (view: EditorView) => {
    editorRef.current = view;
    setIsLoading(false);
    setHasError(false);
    setErrorMessage('');
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [activeTabId]);
  
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      isSavingRef.current = false;
      pendingSaveRef.current = null;
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTabs((items) => {
        const oldIndex = items.findIndex(tab => `tab-${tab.fileId}` === active.id);
        const newIndex = items.findIndex(tab => `tab-${tab.fileId}` === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const activeTab = tabs.find(tab => tab.fileId === activeTabId);

  if (tabs.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full bg-background", className)}>
        <div className="text-center">
          <p className="text-[15px] text-muted-foreground">No files open</p>
          <p className="text-[13px] text-muted-foreground mt-2">
            Select a file from the sidebar to start editing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Draggable Tabs */}
      <div className="h-9 flex items-center bg-card border-b border-border overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tabs.map(tab => `tab-${tab.fileId}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex items-center">
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.fileId}
                  tab={tab}
                  isActive={activeTabId === tab.fileId}
                  onClick={() => setActiveTabId(tab.fileId)}
                  onClose={() => closeTab(tab.fileId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        
        {/* Tab menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-full w-9 rounded-none">
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setTabs(tabs.filter(tab => tab.fileId === activeTabId));
            }}>
              Close Other Tabs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setTabs([]);
              setActiveTabId(null);
            }}>
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* AI Completion Controls */}
        <div className="ml-auto flex items-center px-2 gap-2">
          {/* AI Status Badge */}
          {aiProcessing && (
            <Badge variant="outline" className="text-[11px] bg-card border-primary">
              <Sparkles className="h-3 w-3 mr-1 animate-pulse" />
              AI Processing...
            </Badge>
          )}
          
          {/* AI Toggle Button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={aiPreferences.enabled ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    aiPreferences.enabled && "bg-primary hover:bg-primary/90"
                  )}
                  onClick={toggleAIEnabled}
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-semibold">AI Code Completion {aiPreferences.enabled ? 'Enabled' : 'Disabled'}</p>
                  <p className="text-[11px]">Press Ctrl+Alt+Space to trigger manually</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* AI Settings Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>AI Code Completion Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Model Selection */}
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">AI Model</DropdownMenuLabel>
              {getAvailableModels().map((model) => (
                <DropdownMenuCheckboxItem
                  key={model.value}
                  checked={aiPreferences.model === model.value}
                  onCheckedChange={() => setAIModel(model.value)}
                >
                  <div>
                    <div className="font-medium">{model.label}</div>
                    <div className="text-[11px] text-muted-foreground">{model.description}</div>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
              
              <DropdownMenuSeparator />
              
              {/* Auto-trigger Toggle */}
              <DropdownMenuItem 
                className="flex items-center justify-between"
                onSelect={(e) => e.preventDefault()}
              >
                <Label htmlFor="auto-trigger" className="cursor-pointer">Auto-trigger</Label>
                <Switch
                  id="auto-trigger"
                  checked={aiPreferences.autoTrigger}
                  onCheckedChange={toggleAutoTrigger}
                />
              </DropdownMenuItem>
              
              {/* Confidence Threshold */}
              <DropdownMenuItem 
                className="flex flex-col gap-1"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between w-full">
                  <Label className="text-[11px]">Confidence Threshold</Label>
                  <span className="text-[11px] text-muted-foreground">{Math.round(aiPreferences.confidenceThreshold * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={aiPreferences.confidenceThreshold * 100}
                  onChange={(e) => setConfidenceThreshold(parseInt(e.target.value) / 100)}
                  className="w-full h-1 bg-muted rounded-lg cursor-pointer"
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center space-y-4">
              <Skeleton className="h-4 w-48 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
              <p className="text-[13px] text-muted-foreground">Loading editor...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10 p-8">
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Editor Failed to Load</AlertTitle>
              <AlertDescription className="mt-2 space-y-3">
                <p>{errorMessage}</p>
                <Button onClick={handleRetry} size="sm" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Loading
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Multi-Editor Manager - CodeMirror 6 instance per tab */}
        <MultiEditorManager
          tabs={tabs.map(tab => ({
            fileId: tab.fileId,
            fileName: tab.fileName,
            content: tab.content,
            language: tab.language,
          }))}
          activeTabId={activeTabId}
          onContentChange={(fileId, content) => {
            setTabs(prevTabs => prevTabs.map(tab =>
              tab.fileId === fileId ? { ...tab, content, isDirty: true } : tab
            ));
            
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            
            const currentVersion = fileVersionsRef.current.get(fileId) || 0;
            
            saveTimeoutRef.current = setTimeout(async () => {
              if (isSavingRef.current && pendingSaveRef.current?.fileId === fileId) {
                pendingSaveRef.current = { fileId, content, version: currentVersion };
                return;
              }
              
              isSavingRef.current = true;
              
              try {
                await onFileUpdate(fileId, content);
                const newVersion = currentVersion + 1;
                fileVersionsRef.current.set(fileId, newVersion);
                
                setTabs(prevTabs => prevTabs.map(tab => {
                  if (tab.fileId === fileId && tab.content === content) {
                    return {
                      ...tab,
                      isDirty: false,
                      version: newVersion,
                      lastSavedContent: content,
                    };
                  }
                  return tab;
                }));
              } catch (error) {
                console.error('Failed to save file:', error);
              } finally {
                isSavingRef.current = false;
                
                if (pendingSaveRef.current && pendingSaveRef.current.fileId === fileId) {
                  const pending = pendingSaveRef.current;
                  pendingSaveRef.current = null;
                  setTimeout(() => {
                    setTabs(prevTabs => prevTabs.map(tab =>
                      tab.fileId === pending.fileId ? { ...tab, content: pending.content, isDirty: true } : tab
                    ));
                  }, 0);
                }
              }
            }, 1000);
          }}
        />
      </div>
    </div>
  );
}
