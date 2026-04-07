import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  MousePointer2,
  Code,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  Hash,
  FileCode,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Save,
  X,
  Layers,
  Wand2
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ElementSelectorData {
  id: string;
  sessionId: string;
  url: string;
  selector: string;
  type: 'css' | 'xpath';
  elementPath: string;
  metadata?: {
    tagName?: string;
    textContent?: string;
    attributes?: Record<string, string>;
  };
  createdAt: Date;
}

interface LiveElementInfo {
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

interface ElementSelectorProps {
  sessionId: string;
  projectId: string;
  previewUrl?: string;
  onCodeChange?: (filePath: string, changes: { styles?: Record<string, string>; text?: string }) => void;
  className?: string;
}

const PRESET_COLORS = [
  '#000000', '#1f2937', '#374151', '#6b7280', '#9ca3af', '#d1d5db',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ffffff', 'transparent',
];

export function ElementSelector({ sessionId, projectId, previewUrl, onCodeChange, className }: ElementSelectorProps) {
  const defaultUrl = typeof window !== 'undefined' ? window.location.origin : 'https://e-code.ai';
  const [pageUrl, setPageUrl] = useState(previewUrl || defaultUrl);
  const [elementDescription, setElementDescription] = useState('');
  const [preferredType, setPreferredType] = useState<'css' | 'xpath'>('css');
  const [openSelectors, setOpenSelectors] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('live');
  
  const [isPickerActive, setIsPickerActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<LiveElementInfo | null>(null);
  const [hoveredElement, setHoveredElement] = useState<LiveElementInfo | null>(null);
  const [editedStyles, setEditedStyles] = useState<Partial<LiveElementInfo['styles']>>({});
  const [editedText, setEditedText] = useState('');
  const [showOutlines, setShowOutlines] = useState(true);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['/api/admin/agent/selector/history', sessionId],
  });

  const selectors: ElementSelectorData[] = historyData?.history || [];

  const { data: previewStatus, refetch: refetchPreview } = useQuery<{
    previewUrl: string | null;
    status: string;
  }>({
    queryKey: ['/api/preview/url', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview/url?projectId=${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to get preview status');
      return response.json();
    },
    enabled: !!projectId && activeTab === 'live',
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/agent/selector/generate`, {
        sessionId,
        projectId,
        pageUrl,
        elementDescription
      });
      return await res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Selector Generated',
        description: data.selector ? `CSS: ${data.selector.cssSelector}` : 'Selector generated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/agent/selector/history', sessionId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate selectors',
        variant: 'destructive',
      });
    },
  });

  const syncCodeMutation = useMutation({
    mutationFn: async (params: { elementPath: string; styles: Record<string, string>; text?: string }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/visual-edit`, {
        sessionId,
        elementPath: params.elementPath,
        styles: params.styles,
        text: params.text,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Changes Synced',
        description: 'Visual edits have been applied to your source code',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync changes to source code',
        variant: 'destructive',
      });
    },
  });

  const injectEditorScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    try {
      const script = `
        (function() {
          if (window.__elementSelectorInjected) return;
          window.__elementSelectorInjected = true;

          let highlightOverlay = document.createElement('div');
          highlightOverlay.id = '__element-selector-overlay';
          highlightOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #8b5cf6;background:rgba(139,92,246,0.1);transition:all 0.15s ease;opacity:0;';
          document.body.appendChild(highlightOverlay);

          let selectedOverlay = document.createElement('div');
          selectedOverlay.id = '__element-selector-selected';
          selectedOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid #22c55e;background:rgba(34,197,94,0.1);';
          document.body.appendChild(selectedOverlay);

          function getElementPath(el) {
            const path = [];
            while (el && el.tagName) {
              let selector = el.tagName.toLowerCase();
              if (el.id) selector += '#' + el.id;
              else if (el.className && typeof el.className === 'string') selector += '.' + el.className.split(' ')[0];
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }

          function generateSelector(el) {
            if (el.id) return '#' + el.id;
            if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
            
            const path = [];
            let current = el;
            while (current && current.tagName && current.tagName !== 'HTML') {
              let selector = current.tagName.toLowerCase();
              if (current.id) {
                path.unshift('#' + current.id);
                break;
              } else if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\\s+/).slice(0, 2).join('.');
                if (classes) selector += '.' + classes;
              }
              path.unshift(selector);
              current = current.parentElement;
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
              selector: generateSelector(el),
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
              canEdit: ['P','H1','H2','H3','H4','H5','H6','SPAN','A','BUTTON','DIV','SECTION','ARTICLE','HEADER','FOOTER','LABEL','LI','TD','TH'].includes(el.tagName)
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
            if (!window.__pickerActive) return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay && !el.id?.startsWith('__element-selector')) {
              const info = getElementInfo(el);
              updateOverlay(highlightOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-hover', data: info }, '*');
            }
          });

          document.addEventListener('click', function(e) {
            if (!window.__pickerActive) return;
            e.preventDefault();
            e.stopPropagation();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay && !el.id?.startsWith('__element-selector')) {
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
            if (e.data.type === 'set-picker-mode') {
              window.__pickerActive = e.data.active;
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
                if (!el.id?.startsWith('__element-selector')) {
                  if (e.data.show) {
                    el.style.outline = '1px dashed rgba(139,92,246,0.3)';
                  } else {
                    el.style.outline = '';
                  }
                }
              });
            }
          });

          console.log('[ElementSelector] Script injected successfully');
        })();
      `;
      
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
    iframe.contentWindow?.postMessage({ type: 'set-picker-mode', active: isPickerActive }, '*');
  }, [isPickerActive]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage({ type: 'show-outlines', show: showOutlines && isPickerActive }, '*');
  }, [showOutlines, isPickerActive]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(injectEditorScript, 500);
  }, [injectEditorScript]);

  const handleStyleChange = useCallback((key: keyof LiveElementInfo['styles'], value: string) => {
    setEditedStyles(prev => ({ ...prev, [key]: value }));
  }, []);

  const applyChanges = useCallback(() => {
    if (!selectedElement) return;

    const changes = { ...editedStyles };
    const textChanged = editedText !== selectedElement.text;

    iframeRef.current?.contentWindow?.postMessage({
      type: 'apply-styles',
      styles: changes,
      text: textChanged ? editedText : undefined
    }, '*');

    toast({ title: 'Changes applied', description: 'Style changes applied to preview' });

    if (onCodeChange) {
      onCodeChange(selectedElement.path, { 
        styles: changes as Record<string, string>, 
        text: textChanged ? editedText : undefined 
      });
    }
  }, [selectedElement, editedStyles, editedText, onCodeChange, toast]);

  const syncToCode = useCallback(() => {
    if (!selectedElement) return;
    
    syncCodeMutation.mutate({
      elementPath: selectedElement.path,
      styles: editedStyles as Record<string, string>,
      text: editedText !== selectedElement.text ? editedText : undefined,
    });
  }, [selectedElement, editedStyles, editedText, syncCodeMutation]);

  const handleRefresh = useCallback(() => {
    const iframe = iframeRef.current;
    const url = previewStatus?.previewUrl || previewUrl;
    if (iframe && url) {
      const urlObj = new URL(url, window.location.origin);
      urlObj.searchParams.set('_t', Date.now().toString());
      iframe.src = urlObj.toString();
    }
    refetchPreview();
  }, [previewStatus?.previewUrl, previewUrl, refetchPreview]);

  const toggleSelector = (selectorId: string) => {
    setOpenSelectors(prev => {
      const next = new Set(prev);
      if (next.has(selectorId)) {
        next.delete(selectorId);
      } else {
        next.add(selectorId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (openSelectors.size === selectors.length) {
      setOpenSelectors(new Set());
    } else {
      setOpenSelectors(new Set(selectors.map(s => s.id)));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Selector copied to clipboard',
    });
  };

  const getSelectorIcon = (type: 'css' | 'xpath') => {
    return type === 'css' ? (
      <Hash className="h-4 w-4 text-blue-500" />
    ) : (
      <FileCode className="h-4 w-4 text-purple-500" />
    );
  };

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

  const livePreviewUrl = previewStatus?.previewUrl || previewUrl;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="live" data-testid="tab-live-picker" className="min-h-[44px] px-2 sm:px-4 text-[11px] sm:text-[13px]">
            <MousePointer2 className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Live Picker</span>
            <span className="sm:hidden">Live</span>
          </TabsTrigger>
          <TabsTrigger value="picker" data-testid="tab-element-picker" className="min-h-[44px] px-2 sm:px-4 text-[11px] sm:text-[13px]">
            <Wand2 className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">AI Picker</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-selector-history" className="min-h-[44px] px-2 sm:px-4 text-[11px] sm:text-[13px]">
            <span className="hidden sm:inline">History ({selectors.length})</span>
            <span className="sm:hidden">{selectors.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="flex-1 flex flex-col gap-2 mt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Button
                variant={isPickerActive ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPickerActive(!isPickerActive)}
                className={cn("min-h-[44px] h-auto px-3 gap-1.5", isPickerActive && "bg-purple-600 hover:bg-purple-700")}
                data-testid="toggle-picker-mode"
              >
                <MousePointer2 className="h-4 w-4" />
                <span className="text-[11px] sm:text-[13px]">{isPickerActive ? 'Picking' : 'Pick'}</span>
              </Button>
              
              <div className="flex items-center gap-1.5 text-[11px] sm:text-[13px] text-muted-foreground">
                <Switch 
                  checked={showOutlines} 
                  onCheckedChange={setShowOutlines} 
                  disabled={!isPickerActive}
                />
                <span className="hidden sm:inline">Outlines</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleRefresh} className="min-h-[44px] min-w-[44px] p-0">
                <RefreshCw className="h-4 w-4" />
              </Button>
              {livePreviewUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.open(livePreviewUrl, '_blank')} 
                  className="min-h-[44px] min-w-[44px] p-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2">
            <div className="h-48 sm:h-64 lg:h-auto lg:flex-1 bg-muted/30 rounded-lg overflow-hidden relative">
              {livePreviewUrl ? (
                <iframe
                  ref={iframeRef}
                  src={livePreviewUrl}
                  className="w-full h-full border-0"
                  title="Live Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  onLoad={handleIframeLoad}
                  data-testid="live-preview-iframe"
                />
              ) : (
                <div className="h-full flex items-center justify-center text-center p-4">
                  <div>
                    <Eye className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-[13px] text-muted-foreground">
                      Preview not available. Start the preview to use live element picking.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {isPickerActive && (
              <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l bg-card flex flex-col rounded-lg max-h-[40vh] lg:max-h-none overflow-hidden">
                <div className="p-2 sm:p-3 border-b">
                  <h3 className="text-[11px] sm:text-[13px] font-semibold">Element Editor</h3>
                </div>

                <ScrollArea className="flex-1">
                  {selectedElement ? (
                    <div className="p-2 sm:p-3 space-y-3">
                      <div className="p-2 sm:p-3 bg-muted rounded-md">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <Code className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
                          <span className="text-[11px] sm:text-[13px] font-medium">{selectedElement.tagName}</span>
                          {selectedElement.id && (
                            <Badge variant="outline" className="text-[9px] sm:text-[10px] h-4 sm:h-5">#{selectedElement.id}</Badge>
                          )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{selectedElement.path}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full min-h-[44px] mt-2 text-[11px] sm:text-[13px]"
                          onClick={() => copyToClipboard((selectedElement as any).selector || selectedElement.path)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy Selector
                        </Button>
                      </div>

                      {selectedElement.canEdit && selectedElement.text && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] sm:text-[11px] flex items-center gap-1">
                            <Type className="w-3 h-3" /> Text
                          </Label>
                          <Input
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="min-h-[44px] text-[11px] sm:text-[13px]"
                            data-testid="live-text-input"
                          />
                        </div>
                      )}

                      <Separator />

                      <div className="space-y-2">
                        <Label className="text-[10px] sm:text-[11px] flex items-center gap-1">
                          <Palette className="w-3 h-3" /> Colors
                        </Label>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="min-h-[44px] justify-start gap-2 text-[11px] sm:text-[13px]">
                                <div className="w-4 h-4 rounded border" style={{ backgroundColor: currentStyles.color }} />
                                Text
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 sm:w-56 p-3" align="start">
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mb-3">
                                {PRESET_COLORS.map(color => (
                                  <button
                                    key={color}
                                    className={cn("w-8 h-8 sm:w-6 sm:h-6 rounded border touch-manipulation", currentStyles.color === color && "ring-2 ring-primary")}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleStyleChange('color', color)}
                                  />
                                ))}
                              </div>
                              <Input
                                type="color"
                                value={currentStyles.color}
                                onChange={(e) => handleStyleChange('color', e.target.value)}
                                className="w-full min-h-[44px]"
                              />
                            </PopoverContent>
                          </Popover>

                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="min-h-[44px] justify-start gap-2 text-[11px] sm:text-[13px]">
                                <div className="w-4 h-4 rounded border" style={{ backgroundColor: currentStyles.backgroundColor }} />
                                BG
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 sm:w-56 p-3" align="start">
                              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1 mb-3">
                                {PRESET_COLORS.map(color => (
                                  <button
                                    key={color}
                                    className={cn("w-8 h-8 sm:w-6 sm:h-6 rounded border touch-manipulation", currentStyles.backgroundColor === color && "ring-2 ring-primary")}
                                    style={{ backgroundColor: color }}
                                    onClick={() => handleStyleChange('backgroundColor', color)}
                                  />
                                ))}
                              </div>
                              <Input
                                type="color"
                                value={currentStyles.backgroundColor === 'transparent' ? '#ffffff' : currentStyles.backgroundColor}
                                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                className="w-full min-h-[44px]"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] sm:text-[11px]">Typography</Label>
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
                              className="min-h-[44px] flex-1 p-0"
                              onClick={() => handleStyleChange('textAlign', value)}
                            >
                              <Icon className="w-4 h-4" />
                            </Button>
                          ))}
                          <Button
                            variant={currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '700' ? "default" : "outline"}
                            size="sm"
                            className="min-h-[44px] flex-1 p-0"
                            onClick={() => handleStyleChange('fontWeight', currentStyles.fontWeight === 'bold' || currentStyles.fontWeight === '700' ? 'normal' : 'bold')}
                          >
                            <Bold className="w-4 h-4" />
                          </Button>
                          <Button
                            variant={currentStyles.fontStyle === 'italic' ? "default" : "outline"}
                            size="sm"
                            className="min-h-[44px] flex-1 p-0"
                            onClick={() => handleStyleChange('fontStyle', currentStyles.fontStyle === 'italic' ? 'normal' : 'italic')}
                          >
                            <Italic className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] sm:text-[11px]">Font Size</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[parseInt(currentStyles.fontSize) || 16]}
                            onValueChange={([v]) => handleStyleChange('fontSize', `${v}px`)}
                            min={8}
                            max={72}
                            step={1}
                            className="flex-1"
                          />
                          <span className="text-[11px] sm:text-[13px] w-10 text-right">{currentStyles.fontSize}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 min-h-[44px] text-[11px] sm:text-[13px]"
                          onClick={() => {
                            setSelectedElement(null);
                            setEditedStyles({});
                          }}
                        >
                          <X className="h-4 w-4 mr-1.5" />
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 min-h-[44px] text-[11px] sm:text-[13px]"
                          onClick={applyChanges}
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          Preview
                        </Button>
                      </div>

                      <Button 
                        size="sm" 
                        className="w-full min-h-[44px] text-[11px] sm:text-[13px] bg-green-600 hover:bg-green-700"
                        onClick={syncToCode}
                        disabled={syncCodeMutation.isPending}
                      >
                        {syncCodeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1.5" />
                        )}
                        Sync to Code
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 sm:p-6 text-center text-muted-foreground">
                      <MousePointer2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-[11px] sm:text-[13px]">Click an element in the preview to edit it</p>
                    </div>
                  )}
                </ScrollArea>

                {hoveredElement && !selectedElement && (
                  <div className="p-2 sm:p-3 border-t bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                        {hoveredElement.tagName} - {hoveredElement.path}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="picker" className="flex-1 flex flex-col gap-3 sm:gap-4 mt-3 sm:mt-4">
          <Card className="p-3 sm:p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url-input" className="text-[11px] sm:text-[13px]">Page URL</Label>
                <Input
                  id="url-input"
                  type="url"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://your-app.repl.co"
                  data-testid="input-page-url"
                  className="min-h-[44px] text-[13px]"
                />
                <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                  Enter the URL of the page to inspect for element selectors
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="element-description" className="text-[11px] sm:text-[13px]">Element Description</Label>
                <Input
                  id="element-description"
                  type="text"
                  value={elementDescription}
                  onChange={(e) => setElementDescription(e.target.value)}
                  placeholder="e.g., Login button, User profile dropdown, Search input"
                  data-testid="input-element-description"
                  className="min-h-[44px] text-[13px]"
                />
                <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                  Describe the element you want to select
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] sm:text-[13px]">Selector Type</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant={preferredType === 'css' ? 'default' : 'outline'}
                    onClick={() => setPreferredType('css')}
                    className="flex-1 min-h-[44px] text-[11px] sm:text-[13px]"
                    data-testid="button-type-css"
                  >
                    <Hash className="h-4 w-4 mr-2" />
                    CSS Selector
                  </Button>
                  <Button
                    variant={preferredType === 'xpath' ? 'default' : 'outline'}
                    onClick={() => setPreferredType('xpath')}
                    className="flex-1 min-h-[44px] text-[11px] sm:text-[13px]"
                    data-testid="button-type-xpath"
                  >
                    <FileCode className="h-4 w-4 mr-2" />
                    XPath
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => generateMutation.mutate(undefined)}
                disabled={generateMutation.isPending || !pageUrl.trim() || !elementDescription.trim()}
                className="w-full min-h-[44px] text-[13px]"
                data-testid="button-generate-selectors"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Analyzing Page...</span>
                    <span className="sm:hidden">Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Generate Selectors</span>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </Button>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] sm:text-[13px] text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">How it works</p>
                    <p className="text-blue-700 dark:text-blue-300 text-[10px] sm:text-[13px]">
                      The AI element selector analyzes the page and generates robust selectors using 
                      data-testid attributes, IDs, and semantic CSS/XPath patterns.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="flex-1 flex flex-col mt-3 sm:mt-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <h3 className="text-base sm:text-[15px] font-semibold">Selector History</h3>
            {selectors.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAll}
                data-testid="button-toggle-all-selectors"
                className="min-h-[44px] text-[11px] sm:text-[13px]"
              >
                {openSelectors.size === selectors.length ? (
                  <>
                    <ChevronUp className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Collapse All</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Expand All</span>
                  </>
                )}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </Card>
                ))}
              </div>
            ) : selectors.length === 0 ? (
              <Card className="p-6 sm:p-8 text-center">
                <MousePointer2 className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-[13px] sm:text-base text-muted-foreground">No selectors generated yet</p>
                <p className="text-[11px] sm:text-[13px] text-muted-foreground mt-1">
                  Use the Live Picker or AI Picker to generate selectors
                </p>
              </Card>
            ) : (
              <div className="space-y-2 sm:space-y-3" data-testid="container-selector-list">
                {selectors.map((selector) => (
                  <Collapsible
                    key={selector.id}
                    open={openSelectors.has(selector.id)}
                    onOpenChange={() => toggleSelector(selector.id)}
                  >
                    <Card>
                      <CollapsibleTrigger asChild>
                        <button 
                          className="w-full p-3 sm:p-4 text-left hover:bg-accent/50 transition-colors rounded-lg min-h-[60px]"
                          data-testid={`button-toggle-selector-${selector.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 sm:gap-4">
                            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 mt-0.5">{getSelectorIcon(selector.type)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                                  <code className="font-mono text-[10px] sm:text-[13px] bg-muted px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[150px] sm:max-w-none">
                                    {selector.selector}
                                  </code>
                                  <Badge
                                    variant={selector.type === 'css' ? 'default' : 'secondary'}
                                    data-testid={`badge-type-${selector.id}`}
                                    className="text-[10px] sm:text-[11px]"
                                  >
                                    {selector.type.toUpperCase()}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-muted-foreground flex-wrap">
                                  <Code className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate max-w-[100px] sm:max-w-[200px]">{selector.url}</span>
                                  <span className="hidden sm:inline">•</span>
                                  <span className="hidden sm:inline">
                                    {new Date(selector.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(selector.selector);
                                }}
                                data-testid={`button-copy-${selector.id}`}
                                className="min-h-[44px] min-w-[44px] p-0"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform flex-shrink-0",
                                  openSelectors.has(selector.id) && "rotate-180"
                                )}
                              />
                            </div>
                          </div>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t p-3 sm:p-4 space-y-3 sm:space-y-4">
                          <div>
                            <Label className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mb-2 block">
                              Element Path
                            </Label>
                            <pre className="bg-muted p-2 sm:p-3 rounded-md text-[10px] sm:text-[11px] font-mono overflow-x-auto">
                              {selector.elementPath}
                            </pre>
                          </div>

                          {selector.metadata && (
                            <div className="space-y-2">
                              {selector.metadata.tagName && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-[11px] sm:text-[13px]">
                                  <span className="text-muted-foreground sm:min-w-[100px]">
                                    Tag Name:
                                  </span>
                                  <code className="bg-muted px-2 py-0.5 rounded text-[10px] sm:text-[11px]">
                                    {selector.metadata.tagName}
                                  </code>
                                </div>
                              )}
                              {selector.metadata.textContent && (
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-[11px] sm:text-[13px]">
                                  <span className="text-muted-foreground sm:min-w-[100px]">
                                    Text Content:
                                  </span>
                                  <span className="flex-1 truncate text-[10px] sm:text-[13px]">
                                    {selector.metadata.textContent}
                                  </span>
                                </div>
                              )}
                              {selector.metadata.attributes && Object.keys(selector.metadata.attributes).length > 0 && (
                                <div>
                                  <Label className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground mb-2 block">
                                    Attributes
                                  </Label>
                                  <div className="bg-muted p-2 sm:p-3 rounded-md space-y-1">
                                    {Object.entries(selector.metadata.attributes).map(([key, value]) => (
                                      <div key={key} className="flex items-start gap-1 sm:gap-2 text-[10px] sm:text-[11px] font-mono flex-wrap">
                                        <span className="text-blue-600 dark:text-blue-400">
                                          {key}:
                                        </span>
                                        <span className="text-green-600 dark:text-green-400 break-all">
                                          "{value}"
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <Button
                            variant="outline"
                            onClick={() => copyToClipboard(selector.selector)}
                            className="w-full min-h-[44px] text-[11px] sm:text-[13px]"
                            data-testid={`button-copy-full-${selector.id}`}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Selector
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
