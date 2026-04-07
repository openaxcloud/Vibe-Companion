import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Maximize2, Minimize2,
  Type, AlignLeft, Image, Code2, List, Palette, Download, Play,
  GripVertical, X, Loader2, ChevronLeft, ChevronRight, FileText,
  Clock, StickyNote, FileDown
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SlideData, SlideContentBlock, SlideTheme } from "@shared/schema";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRESET_THEMES: SlideTheme[] = [
  { name: "Dark Modern", primaryColor: "#0079F2", secondaryColor: "#7C65CB", backgroundColor: "#1a1a2e", textColor: "#ffffff", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#0CCE6B" },
  { name: "Light Clean", primaryColor: "#2563eb", secondaryColor: "#7c3aed", backgroundColor: "#ffffff", textColor: "#1e293b", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#059669" },
  { name: "Sunset Warm", primaryColor: "#f59e0b", secondaryColor: "#ef4444", backgroundColor: "#1c1917", textColor: "#fef3c7", fontFamily: "Georgia, serif", accentColor: "#f97316" },
  { name: "Ocean Blue", primaryColor: "#06b6d4", secondaryColor: "#3b82f6", backgroundColor: "#0c1220", textColor: "#e0f2fe", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#22d3ee" },
  { name: "Forest Green", primaryColor: "#10b981", secondaryColor: "#059669", backgroundColor: "#022c22", textColor: "#d1fae5", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#34d399" },
  { name: "Royal Purple", primaryColor: "#8b5cf6", secondaryColor: "#a855f7", backgroundColor: "#1e1033", textColor: "#ede9fe", fontFamily: "Inter, system-ui, sans-serif", accentColor: "#c084fc" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function createDefaultSlide(order: number): SlideData {
  return {
    id: generateId(),
    order,
    layout: order === 0 ? "title" : "content",
    blocks: order === 0
      ? [
          { id: generateId(), type: "title", content: "Presentation Title" },
          { id: generateId(), type: "body", content: "Click to edit subtitle" },
        ]
      : [
          { id: generateId(), type: "title", content: "Slide Title" },
          { id: generateId(), type: "body", content: "Click to add content" },
        ],
    notes: "",
  };
}

interface SlideEditorProps {
  projectId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function SlideEditor({ projectId }: SlideEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [presentSlideIndex, setPresentSlideIndex] = useState(0);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [presenterTimer, setPresenterTimer] = useState(0);
  const [showPresenterNotes, setShowPresenterNotes] = useState(true);
  const presentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const slidesQuery = useQuery<{ slides: SlideData[]; theme: SlideTheme | null }>({
    queryKey: [`/api/projects/${projectId}/slides`],
  });

  const [localSlides, setLocalSlides] = useState<SlideData[]>([]);
  const [localTheme, setLocalTheme] = useState<SlideTheme>(PRESET_THEMES[0]);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (slidesQuery.data) {
      const slides = slidesQuery.data.slides?.length > 0 ? slidesQuery.data.slides : [createDefaultSlide(0)];
      setLocalSlides(slides);
      if (slidesQuery.data.theme) setLocalTheme(slidesQuery.data.theme);
    }
  }, [slidesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (data: { slides: SlideData[]; theme: SlideTheme }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/slides`, data);
      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/slides`] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const save = useCallback(() => {
    saveMutation.mutate({ slides: localSlides, theme: localTheme });
  }, [localSlides, localTheme, saveMutation]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => save(), 2000);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  const updateSlides = useCallback((updater: (slides: SlideData[]) => SlideData[]) => {
    setLocalSlides(prev => {
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }, []);

  const addSlide = useCallback(() => {
    updateSlides(slides => {
      const newSlide = createDefaultSlide(slides.length);
      const next = [...slides, newSlide];
      setSelectedSlideIndex(next.length - 1);
      return next;
    });
  }, [updateSlides]);

  const deleteSlide = useCallback((index: number) => {
    updateSlides(slides => {
      if (slides.length <= 1) return slides;
      const next = slides.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
      if (selectedSlideIndex >= next.length) setSelectedSlideIndex(Math.max(0, next.length - 1));
      return next;
    });
  }, [selectedSlideIndex, updateSlides]);

  const duplicateSlide = useCallback((index: number) => {
    updateSlides(slides => {
      const dup = {
        ...JSON.parse(JSON.stringify(slides[index])),
        id: generateId(),
        order: slides.length,
      };
      dup.blocks = dup.blocks.map((b: SlideContentBlock) => ({ ...b, id: generateId() }));
      const next = [...slides.slice(0, index + 1), dup, ...slides.slice(index + 1)].map((s, i) => ({ ...s, order: i }));
      setSelectedSlideIndex(index + 1);
      return next;
    });
  }, [updateSlides]);

  const moveSlide = useCallback((index: number, direction: "up" | "down") => {
    updateSlides(slides => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= slides.length) return slides;
      const next = [...slides];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      next.forEach((s, i) => s.order = i);
      setSelectedSlideIndex(targetIndex);
      return next;
    });
  }, [updateSlides]);

  const addBlock = useCallback((type: SlideContentBlock["type"]) => {
    updateSlides(slides => {
      const slide = slides[selectedSlideIndex];
      if (!slide) return slides;
      const defaults: Record<string, string> = {
        title: "New Title",
        body: "New text block",
        image: "",
        code: "// code block\nconsole.log('hello');",
        list: "Item 1\nItem 2\nItem 3",
      };
      const newBlock: SlideContentBlock = { id: generateId(), type, content: defaults[type] };
      return slides.map((s, i) => i === selectedSlideIndex ? { ...s, blocks: [...s.blocks, newBlock] } : s);
    });
  }, [selectedSlideIndex, updateSlides]);

  const updateBlock = useCallback((blockId: string, content: string) => {
    updateSlides(slides =>
      slides.map((s, i) => i === selectedSlideIndex
        ? { ...s, blocks: s.blocks.map((b: SlideContentBlock) => b.id === blockId ? { ...b, content } : b) }
        : s
      )
    );
  }, [selectedSlideIndex, updateSlides]);

  const deleteBlock = useCallback((blockId: string) => {
    updateSlides(slides =>
      slides.map((s, i) => i === selectedSlideIndex
        ? { ...s, blocks: s.blocks.filter((b: SlideContentBlock) => b.id !== blockId) }
        : s
      )
    );
  }, [selectedSlideIndex, updateSlides]);

  const updateNotes = useCallback((notes: string) => {
    updateSlides(slides =>
      slides.map((s, i) => i === selectedSlideIndex ? { ...s, notes } : s)
    );
  }, [selectedSlideIndex, updateSlides]);

  const currentSlide = localSlides[selectedSlideIndex];

  useEffect(() => {
    if (isPresenting) {
      setPresenterTimer(0);
      timerRef.current = setInterval(() => {
        setPresenterTimer(prev => prev + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isPresenting]);

  useEffect(() => {
    if (!isPresenting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsPresenting(false);
      if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setPresentSlideIndex(prev => Math.min(prev + 1, localSlides.length - 1));
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setPresentSlideIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === "Home") {
        e.preventDefault();
        setPresentSlideIndex(0);
      }
      if (e.key === "End") {
        e.preventDefault();
        setPresentSlideIndex(localSlides.length - 1);
      }
      if (e.key === "n" || e.key === "N") {
        setShowPresenterNotes(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPresenting, localSlides.length]);

  useEffect(() => {
    if (isPresenting && presentRef.current) {
      presentRef.current.requestFullscreen?.().catch(() => {});
    }
  }, [isPresenting]);

  const renderSlidePreview = (slide: SlideData, theme: SlideTheme, size: "thumb" | "main" | "present") => {
    const scale = size === "thumb" ? 0.15 : size === "main" ? 0.55 : 1;
    const w = 960 * scale;
    const h = 540 * scale;
    const fontSize = size === "thumb" ? 4 : size === "main" ? 10 : 18;

    return (
      <div
        style={{
          width: w,
          height: h,
          backgroundColor: slide.backgroundColor || theme.backgroundColor,
          fontFamily: theme.fontFamily,
          color: theme.textColor,
          overflow: "hidden",
          position: "relative",
        }}
        className="rounded-md flex flex-col justify-center items-center p-[4%] gap-[2%]"
      >
        {slide.blocks.map((block: SlideContentBlock) => {
          switch (block.type) {
            case "title":
              return (
                <div key={block.id} style={{ fontSize: fontSize * 2.5, fontWeight: 700, textAlign: "center", color: theme.primaryColor, lineHeight: 1.2, width: "100%" }}>
                  {block.content}
                </div>
              );
            case "body":
              return (
                <div key={block.id} style={{ fontSize: fontSize * 1.2, textAlign: "center", opacity: 0.85, width: "100%", lineHeight: 1.5 }}>
                  {block.content}
                </div>
              );
            case "image":
              return (
                <div key={block.id} style={{ width: "60%", height: "40%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {block.content && (block.content.startsWith("http://") || block.content.startsWith("https://")) ? (
                    <img src={block.content} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 4 }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).nextElementSibling as HTMLElement).style.removeProperty("display"); }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 4, border: "1px dashed rgba(255,255,255,0.2)" }}>
                      <span style={{ fontSize: fontSize * 0.8, opacity: 0.4 }}>Enter image URL below</span>
                    </div>
                  )}
                </div>
              );
            case "code":
              return (
                <div key={block.id} style={{ backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 4, padding: fontSize * 0.8, fontFamily: "monospace", fontSize: fontSize * 0.9, width: "80%", textAlign: "left", whiteSpace: "pre-wrap" }}>
                  {block.content}
                </div>
              );
            case "list":
              return (
                <div key={block.id} style={{ fontSize: fontSize * 1.1, textAlign: "left", width: "80%", lineHeight: 1.8 }}>
                  {String(block.content).split("\\n").map((line: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: fontSize * 0.5, alignItems: "flex-start" }}>
                      <span style={{ color: theme.accentColor }}>•</span>
                      <span>{line.replace(/^[-*]\s*/, "")}</span>
                    </div>
                  ))}
                </div>
              );
            default:
              return null;
          }
        })}
        {size !== "thumb" && (
          <div style={{ position: "absolute", bottom: fontSize * 0.5, right: fontSize * 1, fontSize: fontSize * 0.7, opacity: 0.4 }}>
            {slide.order + 1}
          </div>
        )}
      </div>
    );
  };

  if (slidesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--ide-bg)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ide-text-secondary)]" />
      </div>
    );
  }

  if (isPresenting) {
    const presentSlide = localSlides[presentSlideIndex];
    const nextSlide = localSlides[presentSlideIndex + 1];
    const slideNotes = presentSlide?.notes || "";

    return (
      <div ref={presentRef} className="fixed inset-0 z-[9999] bg-black flex flex-col" data-testid="slides-presentation-mode">
        <div className="flex-1 flex min-h-0">
          <div
            className="flex-1 flex items-center justify-center cursor-pointer"
            onClick={() => setPresentSlideIndex(prev => Math.min(prev + 1, localSlides.length - 1))}
          >
            {presentSlide && renderSlidePreview(presentSlide, localTheme, "present")}
          </div>

          {showPresenterNotes && (nextSlide || slideNotes) && (
            <div className="w-[320px] bg-[#111] border-l border-[#333] flex flex-col" onClick={e => e.stopPropagation()}>
              {nextSlide && (
                <div className="p-3 border-b border-[#333]">
                  <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Next Slide</div>
                  <div className="flex justify-center">
                    {renderSlidePreview(nextSlide, localTheme, "thumb")}
                  </div>
                </div>
              )}
              {slideNotes && (
                <div className="flex-1 p-3 overflow-y-auto">
                  <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Speaker Notes</div>
                  <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap" data-testid="text-presenter-notes">
                    {slideNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-[#111] border-t border-[#333]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/60 font-mono" data-testid="text-presenter-timer">{formatTime(presenterTimer)}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7" onClick={() => setPresentSlideIndex(prev => Math.max(prev - 1, 0))} disabled={presentSlideIndex === 0} data-testid="button-present-prev">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-white/60 text-xs font-mono min-w-[60px] text-center" data-testid="text-slide-counter">
              {presentSlideIndex + 1} / {localSlides.length}
            </span>
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7" onClick={() => setPresentSlideIndex(prev => Math.min(prev + 1, localSlides.length - 1))} disabled={presentSlideIndex === localSlides.length - 1} data-testid="button-present-next">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className={`h-7 text-xs ${showPresenterNotes ? "text-white" : "text-white/40"}`} onClick={() => setShowPresenterNotes(p => !p)} title="Toggle notes (N)" data-testid="button-toggle-presenter-notes">
              <StickyNote className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7" onClick={() => setIsPresenting(false)} data-testid="button-exit-present">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)]" data-testid="slide-editor">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--ide-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--ide-text)]">Slide Editor</span>
          <span className="text-xs text-[var(--ide-text-secondary)]">{localSlides.length} slides</span>
          {isDirty && <span className="text-xs text-amber-400">• unsaved</span>}
          {saveMutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-secondary)]" />}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowThemePanel(!showThemePanel)} data-testid="button-toggle-theme">
            <Palette className="w-3.5 h-3.5" /> Theme
          </Button>
          <Button size="sm" variant="ghost" className={`h-7 text-xs gap-1 ${showNotesPanel ? "bg-[var(--ide-hover)]" : ""}`} onClick={() => setShowNotesPanel(!showNotesPanel)} data-testid="button-toggle-notes">
            <StickyNote className="w-3.5 h-3.5" /> Notes
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { setPresentSlideIndex(selectedSlideIndex); setIsPresenting(true); }} data-testid="button-present">
            <Play className="w-3.5 h-3.5" /> Present
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={save} disabled={!isDirty || saveMutation.isPending} data-testid="button-save-slides">
            <Download className="w-3.5 h-3.5" /> Save
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" data-testid="button-export-slides">
                <FileDown className="w-3.5 h-3.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => window.open(`/api/projects/${projectId}/slides/export`, '_blank')} data-testid="button-export-pdf">
                <FileText className="w-3.5 h-3.5 mr-2 text-red-400" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`/api/projects/${projectId}/slides/export/pptx`, '_blank')} data-testid="button-export-pptx">
                <FileDown className="w-3.5 h-3.5 mr-2 text-orange-400" />
                Export as PPTX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[160px] border-r border-[var(--ide-border)] bg-[var(--ide-panel)] overflow-y-auto flex flex-col gap-1 p-2" data-testid="slides-sidebar">
          {localSlides.map((slide, index) => (
            <div
              key={slide.id}
              className={`cursor-pointer rounded-lg border-2 transition-all ${index === selectedSlideIndex ? "border-[#0079F2] ring-1 ring-[#0079F2]/30" : "border-transparent hover:border-[var(--ide-border)]"}`}
              onClick={() => setSelectedSlideIndex(index)}
              data-testid={`slide-thumb-${index}`}
            >
              <div className="relative">
                <div className="absolute top-1 left-1 text-[8px] font-bold text-[var(--ide-text-secondary)] bg-[var(--ide-bg)]/80 rounded px-1">{index + 1}</div>
                {slide.notes && <div className="absolute top-1 right-1"><StickyNote className="w-2.5 h-2.5 text-amber-400/60" /></div>}
                {renderSlidePreview(slide, localTheme, "thumb")}
              </div>
            </div>
          ))}
          <button
            onClick={addSlide}
            className="w-full h-[80px] border-2 border-dashed border-[var(--ide-border)] rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:border-[#0079F2] hover:text-[#0079F2] transition-colors"
            data-testid="button-add-slide"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {showThemePanel && (
            <div className="border-b border-[var(--ide-border)] bg-[var(--ide-panel)] p-3">
              <div className="text-xs font-semibold text-[var(--ide-text-secondary)] mb-2 uppercase tracking-wider">Themes</div>
              <div className="flex gap-2 flex-wrap">
                {PRESET_THEMES.map(theme => (
                  <button
                    key={theme.name}
                    onClick={() => { setLocalTheme(theme); setIsDirty(true); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs ${localTheme.name === theme.name ? "border-[#0079F2] bg-[#0079F2]/10" : "border-[var(--ide-border)] hover:border-[var(--ide-border-hover)]"}`}
                    data-testid={`theme-${theme.name}`}
                  >
                    <div className="flex gap-0.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.backgroundColor }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                    </div>
                    <span className="text-[var(--ide-text)]">{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 flex items-center justify-center p-6 overflow-auto bg-[var(--ide-bg)]">
            {currentSlide && renderSlidePreview(currentSlide, localTheme, "main")}
          </div>

          {showNotesPanel && currentSlide && (
            <div className="border-t border-[var(--ide-border)] bg-[var(--ide-panel)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Speaker Notes</span>
              </div>
              <textarea
                value={currentSlide.notes || ""}
                onChange={e => updateNotes(e.target.value)}
                placeholder="Add speaker notes for this slide..."
                className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-3 py-2 text-xs text-[var(--ide-text)] resize-none min-h-[60px]"
                rows={3}
                data-testid="input-speaker-notes"
              />
            </div>
          )}

          {currentSlide && (
            <div className="border-t border-[var(--ide-border)] bg-[var(--ide-panel)] p-3 max-h-[300px] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Content Blocks</span>
                  <div className="flex gap-1">
                    <button onClick={() => addBlock("title")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Title" data-testid="button-add-title-block"><Type className="w-3.5 h-3.5" /></button>
                    <button onClick={() => addBlock("body")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Body" data-testid="button-add-body-block"><AlignLeft className="w-3.5 h-3.5" /></button>
                    <button onClick={() => addBlock("image")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Image" data-testid="button-add-image-block"><Image className="w-3.5 h-3.5" /></button>
                    <button onClick={() => addBlock("code")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Code" data-testid="button-add-code-block"><Code2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => addBlock("list")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add List" data-testid="button-add-list-block"><List className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => moveSlide(selectedSlideIndex, "up")} disabled={selectedSlideIndex === 0} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)] disabled:opacity-30" data-testid="button-move-slide-up"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveSlide(selectedSlideIndex, "down")} disabled={selectedSlideIndex === localSlides.length - 1} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)] disabled:opacity-30" data-testid="button-move-slide-down"><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => duplicateSlide(selectedSlideIndex)} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" data-testid="button-duplicate-slide"><Copy className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteSlide(selectedSlideIndex)} disabled={localSlides.length <= 1} className="p-1 rounded hover:bg-[var(--ide-hover)] text-red-400 disabled:opacity-30" data-testid="button-delete-slide"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="space-y-2">
                {currentSlide.blocks.map((block: SlideContentBlock) => (
                  <div key={block.id} className="flex items-start gap-2 group">
                    <div className="flex items-center gap-1 pt-1.5 min-w-[50px]">
                      <GripVertical className="w-3 h-3 text-[var(--ide-text-secondary)] opacity-0 group-hover:opacity-100" />
                      <span className="text-[9px] font-semibold text-[var(--ide-text-secondary)] uppercase">{block.type}</span>
                    </div>
                    {block.type === "code" || block.type === "list" ? (
                      <textarea
                        value={block.content}
                        onChange={e => updateBlock(block.id, e.target.value)}
                        className="flex-1 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] resize-none font-mono"
                        rows={3}
                        placeholder={block.type === "code" ? "Enter code..." : "One item per line"}
                        data-testid={`input-block-${block.id}`}
                      />
                    ) : (
                      <input
                        value={block.content}
                        onChange={e => updateBlock(block.id, e.target.value)}
                        placeholder={block.type === "image" ? "https://example.com/image.jpg" : block.type === "title" ? "Slide title" : "Text content"}
                        className="flex-1 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)]"
                        data-testid={`input-block-${block.id}`}
                      />
                    )}
                    <button
                      onClick={() => deleteBlock(block.id)}
                      className="p-1 rounded hover:bg-red-500/10 text-[var(--ide-text-secondary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-block-${block.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export { SlideEditor };
