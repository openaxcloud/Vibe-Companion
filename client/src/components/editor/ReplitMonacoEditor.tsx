import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Square,
  RotateCcw,
  Save,
  Search,
  Replace,
  Settings,
  Maximize2,
  Minimize2,
  Users,
  MessageSquare,
  Zap,
  ChevronDown,
  FileText,
  Clock,
  GitBranch,
  Palette,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EditorFile {
  id: number;
  path: string;
  name: string;
  content: string;
  language: string;
  lastModified: Date;
  isReadOnly?: boolean;
}

interface EditorUser {
  id: number;
  username: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
  selection?: monaco.Range;
}

interface ReplitMonacoEditorProps {
  projectId: number;
  fileId?: number;
  onRunCode?: () => void;
  onStopCode?: () => void;
  isRunning?: boolean;
  showCollaborators?: boolean;
  theme?: "dark" | "light";
}

export function ReplitMonacoEditor({
  projectId,
  fileId,
  onRunCode,
  onStopCode,
  isRunning = false,
  showCollaborators = true,
  theme = "dark"
}: ReplitMonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentFile, setCurrentFile] = useState<EditorFile | null>(null);
  const [collaborators, setCollaborators] = useState<EditorUser[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const { toast } = useToast();

  // Récupération du fichier actuel
  const { data: file, isLoading: fileLoading } = useQuery<EditorFile>({
    queryKey: ["/api/files", fileId],
    enabled: !!fileId,
  });

  // Mutation pour sauvegarder le fichier
  const saveFileMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to save file");
      return response.json();
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
      toast({
        title: "File saved",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/files", fileId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Configuration Monaco Editor
  useEffect(() => {
    if (!editorRef.current || !file) return;

    // Configuration du thème Replit
    monaco.editor.defineTheme("replit-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "7d8590", fontStyle: "italic" },
        { token: "keyword", foreground: "ff7b72" },
        { token: "string", foreground: "a5d6ff" },
        { token: "number", foreground: "79c0ff" },
        { token: "type", foreground: "ffa657" },
        { token: "function", foreground: "d2a8ff" },
        { token: "variable", foreground: "f85149" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#e6edf3",
        "editor.lineHighlightBackground": "#2f3349",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#264f7850",
        "editorLineNumber.foreground": "#7d8590",
        "editorLineNumber.activeForeground": "#e6edf3",
        "editorIndentGuide.background": "#21262d",
        "editorIndentGuide.activeBackground": "#30363d",
        "editorBracketMatch.background": "#3fb95040",
        "editorBracketMatch.border": "#3fb950",
      },
    });

    monaco.editor.defineTheme("replit-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "comment", foreground: "656d76", fontStyle: "italic" },
        { token: "keyword", foreground: "cf222e" },
        { token: "string", foreground: "0a3069" },
        { token: "number", foreground: "0550ae" },
        { token: "type", foreground: "953800" },
        { token: "function", foreground: "8250df" },
        { token: "variable", foreground: "cf222e" },
      ],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#24292f",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editor.selectionBackground": "#b6d7ff",
        "editorLineNumber.foreground": "#656d76",
        "editorLineNumber.activeForeground": "#24292f",
      },
    });

    // Création de l'éditeur
    const editor = monaco.editor.create(editorRef.current, {
      value: file.content,
      language: file.language,
      theme: theme === "dark" ? "replit-dark" : "replit-light",
      fontSize: 14,
      fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
      lineNumbers: "on",
      minimap: {
        enabled: true,
        scale: 1,
      },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: "on",
      renderWhitespace: "selection",
      bracketPairColorization: {
        enabled: true,
      },
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      smoothScrolling: true,
      mouseWheelZoom: true,
      folding: true,
      foldingStrategy: "indentation",
      showFoldingControls: "always",
      unfoldOnClickAfterEndOfLine: false,
      renderLineHighlight: "all",
      selectionHighlight: true,
      occurrencesHighlight: true,
      formatOnType: true,
      formatOnPaste: true,
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showText: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showUsers: true,
        showIssues: true,
      },
    });

    editorInstanceRef.current = editor;

    // Gestion des changements
    const onContentChange = editor.onDidChangeModelContent(() => {
      setHasUnsavedChanges(true);
    });

    // Gestion des raccourcis clavier
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunCode?.();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      onStopCode?.();
    });

    return () => {
      onContentChange.dispose();
      editor.dispose();
      editorInstanceRef.current = null;
    };
  }, [file, theme]);

  const handleSave = () => {
    if (!editorInstanceRef.current || !fileId) return;
    
    const content = editorInstanceRef.current.getValue();
    saveFileMutation.mutate(content);
  };

  const handleFormat = () => {
    if (!editorInstanceRef.current) return;
    
    editorInstanceRef.current.trigger("keyboard", "editor.action.formatDocument", {});
  };

  const handleFind = () => {
    if (!editorInstanceRef.current) return;
    
    editorInstanceRef.current.trigger("keyboard", "actions.find", {});
  };

  const handleReplace = () => {
    if (!editorInstanceRef.current) return;
    
    editorInstanceRef.current.trigger("keyboard", "editor.action.startFindReplaceAction", {});
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const formatLastSaved = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (fileLoading || !file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--replit-editor-bg)]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[var(--replit-accent)] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-[var(--replit-text-secondary)]">Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`flex flex-col bg-[var(--replit-editor-bg)] ${isFullscreen ? 'fixed inset-0 z-50' : 'flex-1'}`}>
        {/* Barre d'outils de l'éditeur */}
        <div className="h-12 bg-[var(--replit-surface)] border-b border-[var(--replit-border)] flex items-center justify-between px-4">
          <div className="flex items-center space-x-3">
            {/* Infos du fichier */}
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-[var(--replit-text-secondary)]" />
              <span className="text-sm font-medium text-[var(--replit-text)]">{file.name}</span>
              {hasUnsavedChanges && (
                <div className="h-2 w-2 bg-[var(--replit-warning)] rounded-full"></div>
              )}
              <Badge variant="outline" className="text-xs">
                {file.language}
              </Badge>
            </div>

            {/* Actions principales */}
            <div className="flex items-center space-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={saveFileMutation.isPending || !hasUnsavedChanges}
                    className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save (Ctrl+S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRunCode}
                    disabled={isRunning}
                    className="text-[var(--replit-green)] hover:bg-[var(--replit-green)]/10"
                  >
                    {isRunning ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isRunning ? "Stop (Ctrl+Shift+Enter)" : "Run (Ctrl+Enter)"}</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status de sauvegarde */}
            <div className="flex items-center space-x-1 text-xs text-[var(--replit-text-secondary)]">
              <Clock className="h-3 w-3" />
              <span>Saved {formatLastSaved(lastSaved)}</span>
            </div>

            {/* Collaborateurs */}
            {showCollaborators && collaborators.length > 0 && (
              <div className="flex items-center space-x-1">
                <Users className="h-4 w-4 text-[var(--replit-text-secondary)]" />
                <div className="flex -space-x-2">
                  {collaborators.slice(0, 3).map((user) => (
                    <Tooltip key={user.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="h-6 w-6 rounded-full border-2 border-[var(--replit-surface)] flex items-center justify-center text-xs font-medium text-white"
                          style={{ backgroundColor: user.color }}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{user.username}</TooltipContent>
                    </Tooltip>
                  ))}
                  {collaborators.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-[var(--replit-text-secondary)] border-2 border-[var(--replit-surface)] flex items-center justify-center text-xs font-medium text-white">
                      +{collaborators.length - 3}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Outils */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
                >
                  <Settings className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-[var(--replit-surface)] border-[var(--replit-border)]">
                <DropdownMenuItem onClick={handleFind} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Search className="mr-2 h-4 w-4" />
                  Find (Ctrl+F)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReplace} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Replace className="mr-2 h-4 w-4" />
                  Replace (Ctrl+H)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleFormat} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  <Palette className="mr-2 h-4 w-4" />
                  Format Document
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
                <DropdownMenuItem onClick={toggleFullscreen} className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="mr-2 h-4 w-4" />
                      Exit Fullscreen
                    </>
                  ) : (
                    <>
                      <Maximize2 className="mr-2 h-4 w-4" />
                      Fullscreen
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Zone de l'éditeur */}
        <div className="flex-1 relative overflow-hidden">
          <div ref={editorRef} className="h-full w-full replit-scrollbar" />
          
          {/* Overlay de status */}
          {isRunning && (
            <div className="absolute top-2 right-2 flex items-center space-x-2 bg-[var(--replit-green)] text-white px-3 py-1 rounded-md text-sm">
              <Zap className="h-3 w-3 animate-pulse" />
              <span>Running</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}