import { useEffect, useRef, useState } from "react";
import * as monaco from 'monaco-editor';
import { setupMonacoTheme, getMonacoEditorOptions } from "@/lib/monaco-setup";
import { File } from "@shared/schema";
import { useCollaboration } from "@/hooks/useCollaboration";
import { RemoteCursor } from "@/components/ui/cursor";
import { Search, XCircle, Maximize2, Minimize2, Code, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

interface CodeEditorProps {
  file: File;
  onChange: (content: string) => void;
}

const CodeEditor = ({ file, onChange }: CodeEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [editorDimensions, setEditorDimensions] = useState({
    lineHeight: 21,
    charWidth: 8.4,
  });
  const [editorElement, setEditorElement] = useState<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorSettings, setEditorSettings] = useState({
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    theme: 'replitDark',
    renderWhitespace: 'selection',
    bracketPairColorization: true,
    formatOnPaste: true,
    formatOnType: false,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  
  // Use the collaboration hook
  const { cursors, collaborators, updateCursorPosition, sendEdit } = useCollaboration(
    file.projectId, 
    file.id
  );
  
  // Update editor when settings change
  const updateEditorSettings = () => {
    if (monacoEditorRef.current) {
      // Update settings that can be changed in real-time
      monacoEditorRef.current.updateOptions({
        fontSize: editorSettings.fontSize,
        tabSize: editorSettings.tabSize,
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        minimap: {
          enabled: editorSettings.minimap,
        },
        theme: editorSettings.theme,
        renderWhitespace: editorSettings.renderWhitespace as any,
        bracketPairColorization: {
          enabled: editorSettings.bracketPairColorization,
        },
        formatOnPaste: editorSettings.formatOnPaste,
        formatOnType: editorSettings.formatOnType,
      });
      
      // Update font info measurements for cursor positioning
      const fontInfo = monacoEditorRef.current.getOption(monaco.editor.EditorOption.fontInfo);
      setEditorDimensions({
        lineHeight: fontInfo.lineHeight,
        charWidth: fontInfo.typicalHalfwidthCharacterWidth,
      });
    }
  };
  
  // Toggle search widget
  const toggleSearch = () => {
    if (monacoEditorRef.current) {
      if (!searchOpen) {
        // Open search widget
        monacoEditorRef.current.getAction('actions.find').run();
      } else {
        // Close search widget
        monacoEditorRef.current.trigger('', 'closeFindWidget', null);
      }
      setSearchOpen(!searchOpen);
    }
  };
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Need to tell Monaco to resize after changing to fullscreen
    setTimeout(() => {
      if (monacoEditorRef.current) {
        monacoEditorRef.current.layout();
      }
    }, 100);
  };
  
  useEffect(() => {
    // Setup Monaco themes and snippets
    setupMonacoTheme();
    
    // Initialize Monaco editor
    if (editorRef.current && !monacoEditorRef.current) {
      // Get editor options with our settings
      const options = getMonacoEditorOptions({
        theme: editorSettings.theme,
        fontSize: editorSettings.fontSize,
        tabSize: editorSettings.tabSize,
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        minimap: editorSettings.minimap,
        bracketPairColorization: editorSettings.bracketPairColorization,
        formatOnPaste: editorSettings.formatOnPaste,
        formatOnType: editorSettings.formatOnType,
        renderWhitespace: editorSettings.renderWhitespace as any,
      });
      
      // Create editor instance
      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        ...options,
        value: file.content || '',
        language: getLanguageFromFilename(file.name),
      });
      
      // Add event listener for content changes
      monacoEditorRef.current.onDidChangeModelContent((e) => {
        const newValue = monacoEditorRef.current?.getValue() || '';
        onChange(newValue);
        
        // Send edit to collaborators
        sendEdit(e.changes);
      });
      
      // Listen for cursor position changes
      monacoEditorRef.current.onDidChangeCursorPosition((e) => {
        updateCursorPosition({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      });
      
      // Get dimensions for cursor positioning
      const fontInfo = monacoEditorRef.current.getOption(monaco.editor.EditorOption.fontInfo);
      setEditorDimensions({
        lineHeight: fontInfo.lineHeight,
        charWidth: fontInfo.typicalHalfwidthCharacterWidth,
      });
      
      // Get the dom node for cursor rendering
      setTimeout(() => {
        if (editorRef.current) {
          setEditorElement(
            editorRef.current.querySelector('.monaco-editor .monaco-scrollable-element .lines-content') as HTMLElement
          );
        }
      }, 100);
      
      // Add keyboard shortcut for search (Cmd+F / Ctrl+F)
      monacoEditorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
        toggleSearch();
      });
      
      // Listen for search widget changes
      monacoEditorRef.current.onDidFocusEditorWidget(() => {
        // Check if search widget is visible
        const findDomNode = document.querySelector('.monaco-editor .find-widget');
        if (findDomNode) {
          setSearchOpen(true);
        }
      });
    }
    
    // Cleanup
    return () => {
      if (monacoEditorRef.current) {
        monacoEditorRef.current.dispose();
        monacoEditorRef.current = null;
      }
    };
  }, []); // Initialize once
  
  // Update editor settings when they change
  useEffect(() => {
    updateEditorSettings();
  }, [editorSettings]);
  
  // Update content when file changes
  useEffect(() => {
    if (monacoEditorRef.current) {
      const currentValue = monacoEditorRef.current.getValue();
      // Only update if content actually changed to avoid cursor position reset
      if (currentValue !== file.content && file.content !== undefined) {
        monacoEditorRef.current.setValue(file.content || '');
      }
      
      // Update language if file extension changed
      const model = monacoEditorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, getLanguageFromFilename(file.name));
      }
    }
  }, [file.name, file.content]);
  
  return (
    <div 
      className={cn(
        "h-full w-full relative flex flex-col",
        isFullscreen && "fixed inset-0 z-50 bg-background"
      )}
    >
      {/* Editor toolbar */}
      <div className="h-10 border-b border-border flex items-center px-2 justify-between">
        <div className="flex items-center space-x-1">
          {/* Language badge */}
          <div className="px-2 py-1 text-xs font-medium rounded bg-secondary text-secondary-foreground">
            {getLanguageFromFilename(file.name)}
          </div>
        </div>
        
        <div className="flex items-center">
          {/* Search button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleSearch}
                  className={cn(
                    "h-8 w-8",
                    searchOpen && "bg-accent text-accent-foreground"
                  )}
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
                          onValueChange={(value) => setEditorSettings({
                            ...editorSettings,
                            theme: value
                          })}
                        >
                          <SelectTrigger className="col-span-3" id="theme">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="replitDark">Dark</SelectItem>
                            <SelectItem value="replitLight">Light</SelectItem>
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
                          <span className="w-8 text-sm">{editorSettings.fontSize}px</span>
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
                          <span className="w-8 text-sm">{editorSettings.tabSize}</span>
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
                      
                      {/* Minimap */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="minimap" className="text-right">
                          Minimap
                        </Label>
                        <div className="col-span-3 flex items-center">
                          <Switch
                            id="minimap"
                            checked={editorSettings.minimap}
                            onCheckedChange={(value) => setEditorSettings({
                              ...editorSettings,
                              minimap: value
                            })}
                          />
                        </div>
                      </div>
                      
                      {/* Bracket pair colorization */}
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bracketPair" className="text-right">
                          Bracket Colors
                        </Label>
                        <div className="col-span-3 flex items-center">
                          <Switch
                            id="bracketPair"
                            checked={editorSettings.bracketPairColorization}
                            onCheckedChange={(value) => setEditorSettings({
                              ...editorSettings,
                              bracketPairColorization: value
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
      <div className="flex-1 relative overflow-hidden">
        <div 
          ref={editorRef} 
          className="h-full w-full"
        />
        
        {/* Collaborators list */}
        {collaborators.length > 0 && (
          <div className="absolute top-2 right-4 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-md border border-border">
            <div className="text-xs font-medium mb-1">Collaborators ({collaborators.length})</div>
            <div className="flex flex-col gap-1">
              {collaborators.map((collaborator) => (
                <div key={collaborator.userId} className="flex items-center gap-1.5 text-xs">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: cursors[collaborator.userId]?.color || '#ccc' }}
                  />
                  <span>{collaborator.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Remote cursors */}
        {Object.values(cursors).map((cursor) => (
          cursor.fileId === file.id && (
            <RemoteCursor
              key={cursor.userId}
              position={cursor.position}
              color={cursor.color}
              username={cursor.username}
              editorElement={editorElement}
              lineHeight={editorDimensions.lineHeight}
              charWidth={editorDimensions.charWidth}
            />
          )
        ))}
      </div>
      
      {/* Status bar */}
      <div className="h-6 border-t border-border bg-background/50 flex items-center px-2 text-xs text-muted-foreground">
        <div className="flex-1 flex items-center space-x-4">
          <div>
            Line: {monacoEditorRef.current?.getPosition()?.lineNumber || 1}
          </div>
          <div>
            Column: {monacoEditorRef.current?.getPosition()?.column || 1}
          </div>
          <div>
            Tab Size: {editorSettings.tabSize}
          </div>
        </div>
        <div>
          {file.name}
        </div>
      </div>
    </div>
  );
};

function getLanguageFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map extensions to Monaco editor language identifiers
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
    'toml': 'ini',
    'ini': 'ini',
  };
  
  return languageMap[extension] || 'plaintext';
}

export default CodeEditor;