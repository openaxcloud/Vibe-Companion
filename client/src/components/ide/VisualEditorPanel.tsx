import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Globe, RefreshCw, ExternalLink, Play, Square, Loader2,
  MousePointer2, Type, Palette, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Save, X, Move, Maximize2, Minimize2,
  Image, Link, Code, Layers, Eye, EyeOff, Undo2, Redo2,
  ZoomIn, ZoomOut, Smartphone, Tablet, Monitor, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  src?: string;
  href?: string;
  path: string;
  rect: { x: number; y: number; width: number; height: number };
  styles: {
    color?: string;
    backgroundColor?: string;
    fontSize?: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: string;
    textAlign?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
    opacity?: string;
  };
  canEdit: boolean;
}

interface VisualEditorPanelProps {
  projectId: string;
  onCodeChange?: (filePath: string, changes: string) => void;
  className?: string;
}

const VIEWPORT_PRESETS = [
  { name: 'Mobile S', width: 320, height: 568, icon: Smartphone },
  { name: 'Mobile M', width: 375, height: 667, icon: Smartphone },
  { name: 'Mobile L', width: 425, height: 812, icon: Smartphone },
  { name: 'Tablet', width: 768, height: 1024, icon: Tablet },
  { name: 'Laptop', width: 1024, height: 768, icon: Monitor },
  { name: 'Desktop', width: 1440, height: 900, icon: Monitor },
];

const PRESET_COLORS = [
  '#000000', '#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ffffff', 'transparent',
];

export function VisualEditorPanel({ projectId, onCodeChange, className }: VisualEditorPanelProps) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasAttemptedAutoStart = useRef(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [editedStyles, setEditedStyles] = useState<Partial<ElementInfo['styles']>>({});
  const [editedText, setEditedText] = useState('');
  const [viewportPreset, setViewportPreset] = useState(VIEWPORT_PRESETS[5]);
  const [zoom, setZoom] = useState(100);
  const [showOutlines, setShowOutlines] = useState(true);
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  const { data: previewStatus, isLoading: isStatusLoading, refetch: refetchStatus } = useQuery<{
    previewUrl: string | null;
    status: 'running' | 'stopped' | 'starting' | 'error' | 'static' | 'no_runnable_files';
    message?: string;
  }>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview/url?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to get preview status');
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: (_data, _query) => {
      const data = _data;
      if (data?.status === 'starting') return 2000;
      if (data?.status === 'running') return 10000;
      return false;
    }
  });

  const startPreviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/preview/projects/${projectId}/preview/start`, {});
    },
    onSuccess: () => {
      toast({ title: 'Preview starting...' });
      setTimeout(() => refetchStatus(), 2000);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to start preview', description: error.message, variant: 'destructive' });
    }
  });

  useEffect(() => {
    if (previewStatus?.status === 'stopped' && !hasAttemptedAutoStart.current) {
      hasAttemptedAutoStart.current = true;
      startPreviewMutation.mutate(undefined);
    }
  }, [previewStatus?.status]);

  const injectEditorScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const script = `
        (function() {
          if (window.__visualEditorInjected) return;
          window.__visualEditorInjected = true;

          let highlightOverlay = document.createElement('div');
          highlightOverlay.id = '__visual-editor-overlay';
          highlightOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #8b5cf6;background:rgba(139,92,246,0.1);transition:all 0.15s ease;opacity:0;';
          document.body.appendChild(highlightOverlay);

          let selectedOverlay = document.createElement('div');
          selectedOverlay.id = '__visual-editor-selected';
          selectedOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid #22c55e;background:rgba(34,197,94,0.1);';
          document.body.appendChild(selectedOverlay);

          function getElementPath(el) {
            const path = [];
            while (el && el.tagName) {
              let selector = el.tagName.toLowerCase();
              if (el.id) selector += '#' + el.id;
              else if (el.className) selector += '.' + el.className.split(' ')[0];
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }

          function getElementInfo(el) {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            return {
              tagName: el.tagName,
              id: el.id || undefined,
              className: el.className || undefined,
              text: el.innerText?.substring(0, 200),
              src: el.src,
              href: el.href,
              path: getElementPath(el),
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              styles: {
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                fontSize: styles.fontSize,
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
                textDecoration: styles.textDecoration,
                textAlign: styles.textAlign,
                padding: styles.padding,
                margin: styles.margin,
                borderRadius: styles.borderRadius,
                opacity: styles.opacity
              },
              canEdit: ['P','H1','H2','H3','H4','H5','H6','SPAN','A','BUTTON','DIV','SECTION','ARTICLE','HEADER','FOOTER','LABEL'].includes(el.tagName)
            };
          }

          function updateOverlay(overlay, rect, show) {
            if (show && rect) {
              overlay.style.left = rect.x + 'px';
              overlay.style.top = rect.y + 'px';
              overlay.style.width = rect.width + 'px';
              overlay.style.height = rect.height + 'px';
              overlay.style.opacity = '1';
            } else {
              overlay.style.opacity = '0';
            }
          }

          document.addEventListener('mousemove', function(e) {
            if (!window.__editModeActive) return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay) {
              const info = getElementInfo(el);
              updateOverlay(highlightOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-hover', data: info }, '*');
            }
          });

          document.addEventListener('click', function(e) {
            if (!window.__editModeActive) return;
            e.preventDefault();
            e.stopPropagation();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay) {
              window.__selectedElement = el;
              const info = getElementInfo(el);
              updateOverlay(selectedOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-select', data: info }, '*');
            }
          }, true);

          document.addEventListener('mouseleave', function() {
            updateOverlay(highlightOverlay, null, false);
            window.parent.postMessage({ type: 'element-hover', data: null }, '*');
          });

          window.addEventListener('message', function(e) {
            if (e.data.type === 'set-edit-mode') {
              window.__editModeActive = e.data.active;
              if (!e.data.active) {
                updateOverlay(highlightOverlay, null, false);
                updateOverlay(selectedOverlay, null, false);
              }
            } else if (e.data.type === 'apply-styles' && window.__selectedElement) {
              Object.assign(window.__selectedElement.style, e.data.styles);
              if (e.data.text !== undefined) {
                window.__selectedElement.innerText = e.data.text;
              }
              const info = getElementInfo(window.__selectedElement);
              updateOverlay(selectedOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-updated', data: info }, '*');
            } else if (e.data.type === 'show-outlines') {
              document.querySelectorAll('*').forEach(el => {
                if (e.data.show) {
                  el.style.outline = '1px dashed rgba(139,92,246,0.3)';
                } else {
                  el.style.outline = '';
                }
              });
            }
          });

          console.log('[VisualEditor] Script injected successfully');
        })();
      `;
      
      iframe.contentWindow.postMessage({ type: 'inject-script', script }, '*');
      
      const doc = iframe.contentDocument;
      if (doc) {
        const scriptEl = doc.createElement('script');
        scriptEl.textContent = script;
        doc.body.appendChild(scriptEl);
      }
    } catch (error) {
    }
  }, []);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'element-hover') {
        setHoveredElement(e.data.data);
      } else if (e.data.type === 'element-select') {
        setSelectedElement(e.data.data);
        setEditedText(e.data.data?.text || '');
        setEditedStyles({});
      } else if (e.data.type === 'element-updated') {
        setSelectedElement(e.data.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.contentWindow?.postMessage({ type: 'set-edit-mode', active: isEditMode }, '*');
  }, [isEditMode]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    iframe.contentWindow?.postMessage({ type: 'show-outlines', show: showOutlines && isEditMode }, '*');
  }, [showOutlines, isEditMode]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(injectEditorScript, 500);
  }, [injectEditorScript]);

  const handleStyleChange = useCallback((key: keyof ElementInfo['styles'], value: string) => {
    setEditedStyles(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyChanges = useCallback(() => {
    if (!selectedElement) return;

    const changes = { ...editedStyles };
    const textChanged = editedText !== selectedElement.text;

    setUndoStack(prev => [...prev, { element: selectedElement, styles: editedStyles, text: textChanged ? editedText : undefined }]);
    setRedoStack([]);

    iframeRef.current?.contentWindow?.postMessage({
      type: 'apply-styles',
      styles: changes,
      text: textChanged ? editedText : undefined
    }, '*');

    toast({ title: 'Changes applied', description: 'Style changes applied to preview' });

    if (onCodeChange) {
      onCodeChange(selectedElement.path, JSON.stringify({ styles: changes, text: textChanged ? editedText : undefined }));
    }
  }, [selectedElement, editedStyles, editedText, onCodeChange]);

  const handleRefresh = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe && previewStatus?.previewUrl) {
      const url = new URL(previewStatus.previewUrl, window.location.origin);
      url.searchParams.set('_t', Date.now().toString());
      iframe.src = url.toString();
    }
    refetchStatus();
  }, [previewStatus?.previewUrl, refetchStatus]);

  const isPreviewRunning = previewStatus?.status === 'running' || previewStatus?.status === 'static';
  const canShowPreview = isPreviewRunning && previewStatus?.previewUrl;

  const currentStyles = {
    color: editedStyles.color || selectedElement?.styles.color || '#000000',
    backgroundColor: editedStyles.backgroundColor || selectedElement?.styles.backgroundColor || 'transparent',
    textAlign: editedStyles.textAlign || selectedElement?.styles.textAlign || 'left',
    fontWeight: editedStyles.fontWeight || selectedElement?.styles.fontWeight || 'normal',
    fontStyle: editedStyles.fontStyle || selectedElement?.styles.fontStyle || 'normal',
    fontSize: editedStyles.fontSize || selectedElement?.styles.fontSize || '16px',
    borderRadius: editedStyles.borderRadius || selectedElement?.styles.borderRadius || '0px',
    opacity: editedStyles.opacity || selectedElement?.styles.opacity || '1',
  };

  return (
    <div className={cn("h-full flex flex-col bg-[var(--ecode-surface)]", className)}>
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 gap-2 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--ecode-text-muted)]" />
          <span className="text-xs font-medium text-[var(--ecode-text-muted)]">Visual Editor</span>
          {isPreviewRunning && (
            <Badge variant="secondary" className="text-[11px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              Live
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn("h-7 gap-1", isEditMode && "bg-purple-600 hover:bg-purple-700")}
            data-testid="toggle-edit-mode"
          >
            <MousePointer2 className="h-3.5 w-3.5" />
            <span className="text-[11px] hidden sm:inline">{isEditMode ? 'Editing' : 'Edit'}</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 px-2">
                {viewportPreset.icon && <viewportPreset.icon className="h-3.5 w-3.5" />}
                <span className="text-[11px] hidden md:inline">{viewportPreset.name}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <div className="space-y-1">
                {VIEWPORT_PRESETS.map(preset => (
                  <Button
                    key={preset.name}
                    variant={viewportPreset.name === preset.name ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-8"
                    onClick={() => setViewportPreset(preset)}
                  >
                    <preset.icon className="h-3.5 w-3.5" />
                    <span className="text-[11px]">{preset.name}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{preset.width}×{preset.height}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-1 border rounded px-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(Math.max(25, zoom - 25))}>
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-[11px] w-10 text-center">{zoom}%</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(Math.min(200, zoom + 25))}>
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 w-7 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-auto">
          {isStatusLoading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : canShowPreview ? (
            <div 
              className="bg-white rounded-lg shadow-lg overflow-hidden transition-all"
              style={{
                width: viewportPreset.width * (zoom / 100),
                height: viewportPreset.height * (zoom / 100),
              }}
            >
              <iframe
                ref={iframeRef}
                src={previewStatus.previewUrl || ''}
                className="w-full h-full border-0"
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                  width: viewportPreset.width,
                  height: viewportPreset.height,
                }}
                title="Visual Editor Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                onLoad={handleIframeLoad}
                data-testid="visual-editor-iframe"
              />
            </div>
          ) : (
            <div className="text-center p-8">
              <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-[15px] font-semibold mb-2">Preview not available</h3>
              <p className="text-[13px] text-muted-foreground mb-4">Start the preview to use the visual editor</p>
              <Button onClick={() => startPreviewMutation.mutate(undefined)}>
                <Play className="h-4 w-4 mr-2" />
                Start Preview
              </Button>
            </div>
          )}
        </div>

        {isEditMode && (
          <div className="w-72 border-l bg-card flex flex-col">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold">Element Inspector</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={undoStack.length === 0}>
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={redoStack.length === 0}>
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch checked={showOutlines} onCheckedChange={setShowOutlines} className="scale-75" />
                <span>Show element outlines</span>
              </div>
            </div>

            <ScrollArea className="flex-1">
              {selectedElement ? (
                <div className="p-3 space-y-4">
                  <div className="p-2 bg-surface-tertiary-solid rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Code className="h-3.5 w-3.5 text-purple-500" />
                      <span className="text-[11px] font-medium">{selectedElement.tagName}</span>
                      {selectedElement.id && (
                        <Badge variant="outline" className="text-[10px] h-4">#{selectedElement.id}</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{selectedElement.path}</p>
                  </div>

                  {selectedElement.canEdit && selectedElement.text && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] flex items-center gap-1.5">
                        <Type className="w-3 h-3" /> Text Content
                      </Label>
                      <Input
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="h-8 text-[11px]"
                        data-testid="text-content-input"
                      />
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-[11px] flex items-center gap-1.5">
                      <Palette className="w-3 h-3" /> Colors
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Text</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 justify-start gap-2">
                              <div className="w-4 h-4 rounded border" style={{ backgroundColor: currentStyles.color }} />
                              <span className="text-[11px] truncate">{currentStyles.color}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2">
                            <div className="grid grid-cols-6 gap-1 mb-2">
                              {PRESET_COLORS.map(color => (
                                <button
                                  key={color}
                                  className={cn("w-5 h-5 rounded border", currentStyles.color === color && "ring-2 ring-primary")}
                                  style={{ backgroundColor: color }}
                                  onClick={() => handleStyleChange('color', color)}
                                />
                              ))}
                            </div>
                            <Input
                              type="color"
                              value={currentStyles.color}
                              onChange={(e) => handleStyleChange('color', e.target.value)}
                              className="w-full h-8"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Background</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full h-8 justify-start gap-2">
                              <div className="w-4 h-4 rounded border" style={{ backgroundColor: currentStyles.backgroundColor }} />
                              <span className="text-[11px] truncate">BG</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-2">
                            <div className="grid grid-cols-6 gap-1 mb-2">
                              {PRESET_COLORS.map(color => (
                                <button
                                  key={color}
                                  className={cn("w-5 h-5 rounded border", currentStyles.backgroundColor === color && "ring-2 ring-primary")}
                                  style={{ backgroundColor: color }}
                                  onClick={() => handleStyleChange('backgroundColor', color)}
                                />
                              ))}
                            </div>
                            <Input
                              type="color"
                              value={currentStyles.backgroundColor === 'transparent' ? '#ffffff' : currentStyles.backgroundColor}
                              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                              className="w-full h-8"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-[11px]">Typography</Label>
                    <div className="flex gap-1">
                      {[
                        { value: 'left', icon: AlignLeft },
                        { value: 'center', icon: AlignCenter },
                        { value: 'right', icon: AlignRight },
                      ].map(({ value, icon: Icon }) => (
                        <Button
                          key={value}
                          variant={currentStyles.textAlign === value ? "default" : "outline"}
                          size="sm"
                          className="h-7 flex-1"
                          onClick={() => handleStyleChange('textAlign', value)}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </Button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant={currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '700' ? "default" : "outline"}
                        size="sm"
                        className="h-7 flex-1"
                        onClick={() => handleStyleChange('fontWeight', currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '700' ? 'normal' : 'bold')}
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant={currentStyles.fontStyle === 'italic' ? "default" : "outline"}
                        size="sm"
                        className="h-7 flex-1"
                        onClick={() => handleStyleChange('fontStyle', currentStyles.fontStyle === 'italic' ? 'normal' : 'italic')}
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-[11px]">Font Size</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[parseInt(currentStyles.fontSize) || 16]}
                        onValueChange={([v]) => handleStyleChange('fontSize', `${v}px`)}
                        min={8}
                        max={72}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[11px] w-10 text-right">{currentStyles.fontSize}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px]">Border Radius</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[parseInt(currentStyles.borderRadius) || 0]}
                        onValueChange={([v]) => handleStyleChange('borderRadius', `${v}px`)}
                        min={0}
                        max={50}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-[11px] w-10 text-right">{currentStyles.borderRadius}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px]">Opacity</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[parseFloat(currentStyles.opacity) * 100 || 100]}
                        onValueChange={([v]) => handleStyleChange('opacity', String(v / 100))}
                        min={0}
                        max={100}
                        step={5}
                        className="flex-1"
                      />
                      <span className="text-[11px] w-10 text-right">{Math.round(parseFloat(currentStyles.opacity) * 100)}%</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      setSelectedElement(null);
                      setEditedStyles({});
                    }}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" onClick={applyChanges}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      Apply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MousePointer2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-[13px] font-medium mb-1">Click an element to edit</p>
                  <p className="text-[11px]">Select any element in the preview to modify its styles</p>
                </div>
              )}
            </ScrollArea>

            {hoveredElement && !selectedElement && (
              <div className="p-2 border-t bg-muted/30">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground truncate">{hoveredElement.tagName} - {hoveredElement.path}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
