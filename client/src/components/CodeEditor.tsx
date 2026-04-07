import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView } from '@codemirror/view';
import { CM6Editor } from "@/components/editor/CM6Editor";
import { File } from "@shared/schema";
import { Search, Maximize2, Minimize2, Settings, Share2, Save, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareSnippetDialog } from "@/components/ShareSnippetDialog";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { apiRequest } from '@/lib/queryClient';

interface Collaborator {
  clientId: number;
  userId: number;
  username: string;
  color: string;
  cursor?: {
    position: {
      lineNumber: number;
      column: number;
    };
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
}

interface CodeEditorProps {
  file: File;
  onChange: (content: string) => void;
  onSelectionChange?: (selectedText: string | undefined) => void;
  collaboration?: {
    collaborators: Collaborator[];
    isConnected: boolean;
    followingUserId: number | null;
    followUser: (userId: number) => void;
    setEditor?: (editor: EditorView | null) => void;
    setModel?: (model: unknown | null) => void;
  };
}

const CodeEditor = ({ file, onChange, onSelectionChange, collaboration }: CodeEditorProps) => {
  const editorViewRef = useRef<EditorView | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [editorSettings, setEditorSettings] = useState({
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    theme: 'dark' as 'dark' | 'light',
    autoSave: true,
    autoSaveDelay: 2000,
  });
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareData, setShareData] = useState<{
    code: string;
    lineStart: number;
    lineEnd: number;
  }>({ code: "", lineStart: 1, lineEnd: 1 });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveQueueRef = useRef<string | null>(null);
  const isSavingRef = useRef(false);
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleShare = () => {
    if (!editorViewRef.current) return;
    
    const view = editorViewRef.current;
    const state = view.state;
    const selection = state.selection.main;
    
    let code = "";
    let lineStart = 1;
    let lineEnd = state.doc.lines;
    
    if (!selection.empty) {
      code = state.sliceDoc(selection.from, selection.to);
      lineStart = state.doc.lineAt(selection.from).number;
      lineEnd = state.doc.lineAt(selection.to).number;
    } else {
      code = state.doc.toString();
    }
    
    setShareData({ code, lineStart, lineEnd });
    setShareDialogOpen(true);
  };
  
  const handleAutoSave = useCallback((content: string) => {
    if (!editorSettings.autoSave) return;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveFile(content);
    }, editorSettings.autoSaveDelay);
  }, [editorSettings.autoSave, editorSettings.autoSaveDelay]);
  
  const saveFile = async (content?: string) => {
    if (!file.id) return;
    
    const fileContent = content ?? editorViewRef.current?.state.doc.toString() ?? file.content;
    
    // If already saving, queue this content for later
    if (isSavingRef.current) {
      saveQueueRef.current = fileContent;
      return;
    }
    
    isSavingRef.current = true;
    setIsSaving(true);
    
    try {
      const response = await apiRequest('PATCH', `/api/files/${file.id}`, {
        content: fileContent,
      });
      
      if (response.ok) {
        setLastSaved(new Date());
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
          autoSaveTimeoutRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      
      // Process queued save if any
      if (saveQueueRef.current !== null) {
        const queuedContent = saveQueueRef.current;
        saveQueueRef.current = null;
        saveFile(queuedContent);
      }
    }
  };

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
    handleAutoSave(newValue);
    
    apiRequest('POST', `/api/realtime/${file.projectId}/file-change`, {
      fileId: file.id,
      path: file.path,
      content: newValue
    }).catch(console.error);
  }, [onChange, handleAutoSave, file.projectId, file.id, file.path]);

  const handleEditorMount = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    
    if (collaboration?.setEditor) {
      collaboration.setEditor(view);
    }
    
    const updateCursorPosition = () => {
      const state = view.state;
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);
      setCursorPosition({
        line: line.number,
        column: pos - line.from + 1,
      });
      
      if (onSelectionChange) {
        const selection = state.selection.main;
        if (!selection.empty) {
          const selectedText = state.sliceDoc(selection.from, selection.to);
          onSelectionChange(selectedText);
        } else {
          onSelectionChange(undefined);
        }
      }
    };
    
    updateCursorPosition();
    
    view.dom.addEventListener('keyup', updateCursorPosition);
    view.dom.addEventListener('mouseup', updateCursorPosition);
  }, [collaboration, onSelectionChange]);

  const handleSearch = useCallback(() => {
    if (!editorViewRef.current) return;
    
    const view = editorViewRef.current;
    view.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: navigator.platform.includes('Mac') ? false : true,
      metaKey: navigator.platform.includes('Mac') ? true : false,
      bubbles: true,
    });
    view.dom.dispatchEvent(event);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className={cn(
        "h-full w-full relative flex flex-col",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Editor toolbar */}
      <div className="h-10 border-b border-border flex items-center px-2 justify-between">
        <div className="flex items-center space-x-2">
          {/* Language badge */}
          <div className="px-2 py-1 text-[11px] font-medium rounded bg-secondary text-secondary-foreground">
            {getLanguageFromFilename(file.name)}
          </div>
          
          {/* Auto-save indicator */}
          {editorSettings.autoSave && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {isSaving ? (
                <>
                  <Save className="h-3 w-3 animate-pulse" />
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>Saved {getTimeAgo(lastSaved)}</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  <span>Auto-save enabled</span>
                </>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center">
          {/* Search button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleSearch}
                  className="h-8 w-8"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Search (Cmd+F / Ctrl+F)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Editor settings */}
          <TooltipProvider>
            <Tooltip>
              <Popover>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Editor Settings</h4>
                    <div className="space-y-3">
                      {/* Theme selector */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="theme" className="text-right">
                          Theme
                        </Label>
                        <Select 
                          value={editorSettings.theme} 
                          onValueChange={(value: 'dark' | 'light') => setEditorSettings({
                            ...editorSettings,
                            theme: value
                          })}
                        >
                          <SelectTrigger className="col-span-3" id="theme">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Font size */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fontSize" className="text-right">
                          Font Size
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Slider
                            id="fontSize"
                            min={10}
                            max={24}
                            step={1}
                            value={[editorSettings.fontSize]}
                            onValueChange={(value) => setEditorSettings({
                              ...editorSettings,
                              fontSize: value[0]
                            })}
                            className="flex-1"
                          />
                          <span className="w-8 text-[13px]">{editorSettings.fontSize}px</span>
                        </div>
                      </div>
                      
                      {/* Tab size */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="tabSize" className="text-right">
                          Tab Size
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Slider
                            id="tabSize"
                            min={2}
                            max={8}
                            step={2}
                            value={[editorSettings.tabSize]}
                            onValueChange={(value) => setEditorSettings({
                              ...editorSettings,
                              tabSize: value[0]
                            })}
                            className="flex-1"
                          />
                          <span className="w-8 text-[13px]">{editorSettings.tabSize}</span>
                        </div>
                      </div>
                      
                      {/* Word wrap */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="wordWrap" className="text-right">
                          Word Wrap
                        </Label>
                        <div className="col-span-3 flex items-center">
                          <Switch
                            id="wordWrap"
                            checked={editorSettings.wordWrap}
                            onCheckedChange={(value) => setEditorSettings({
                              ...editorSettings,
                              wordWrap: value
                            })}
                          />
                        </div>
                      </div>
                      
                      {/* Auto-save toggle */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="autoSave" className="text-right">
                          Auto Save
                        </Label>
                        <div className="col-span-3 flex items-center">
                          <Switch
                            id="autoSave"
                            checked={editorSettings.autoSave}
                            onCheckedChange={(value) => setEditorSettings({
                              ...editorSettings,
                              autoSave: value
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <TooltipContent>
                <p>Editor Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Share button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleShare}
                  className="h-8 w-8"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share Code Snippet</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Fullscreen toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleFullscreen}
                  className="h-8 w-8"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle Fullscreen</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Main editor area */}
      <div 
        className="flex-1 relative overflow-hidden"
        style={{ fontSize: `${editorSettings.fontSize}px` }}
      >
        <CM6Editor
          value={file.content || ''}
          language={getLanguageFromFilename(file.name)}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme={editorSettings.theme}
          tabSize={editorSettings.tabSize}
          lineWrapping={editorSettings.wordWrap}
          height="100%"
          className="h-full"
        />
        
        {/* Collaborators indicator */}
        {collaboration && collaboration.collaborators.length > 0 && (
          <div className="absolute top-2 right-4 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-md border border-border">
            <div className="text-[11px] font-medium mb-1">Collaborators ({collaboration.collaborators.length})</div>
            <div className="flex flex-col gap-1">
              {collaboration.collaborators.map((collaborator) => (
                <div key={collaborator.userId} className="flex items-center gap-1.5 text-[11px]">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: collaborator.color }}
                  />
                  <span>{collaborator.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Status bar */}
      <div className="h-6 border-t border-border bg-background/50 flex items-center px-2 text-[11px] text-muted-foreground">
        <div className="flex-1 flex items-center space-x-4">
          <div>
            Line: {cursorPosition.line}
          </div>
          <div>
            Column: {cursorPosition.column}
          </div>
          <div>
            Tab Size: {editorSettings.tabSize}
          </div>
        </div>
        <div>
          {file.name}
        </div>
      </div>
      
      {/* Share snippet dialog */}
      <ShareSnippetDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        projectId={typeof file.projectId === 'string' ? parseInt(file.projectId, 10) : (file.projectId || 0)}
        fileName={file.name}
        filePath={file.path || file.name}
        code={shareData.code}
        language={getLanguageFromFilename(file.name)}
        lineStart={shareData.lineStart}
        lineEnd={shareData.lineEnd}
      />
    </div>
  );
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'go': 'go',
    'php': 'php',
    'rs': 'rust',
    'sql': 'sql',
    'sh': 'shell',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
  };
  
  return languageMap[extension] || 'plaintext';
}

export default CodeEditor;
