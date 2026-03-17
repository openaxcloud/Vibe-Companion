import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Plus, StickyNote, Type, Image, ZoomIn, ZoomOut, Maximize2,
  Grid3x3, Move, Trash2, Copy, Pencil, X, MoreHorizontal, Frame,
  ChevronDown, Minus, RotateCcw
} from "lucide-react";
import type { CanvasFrame, CanvasAnnotation } from "@shared/schema";
import { apiRequest, getCsrfToken } from "@/lib/queryClient";

interface CanvasMessage {
  type: string;
  data?: Record<string, unknown>;
}

interface DesignCanvasProps {
  projectId: string;
  messages?: CanvasMessage[];
}

interface DragState {
  type: "move" | "resize";
  itemType: "frame" | "annotation";
  itemId: string;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
  originalW: number;
  originalH: number;
  resizeDir?: string;
}

const GRID_SIZE = 20;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

export default function DesignCanvas({ projectId, messages = [] }: DesignCanvasProps) {
  const [frames, setFrames] = useState<CanvasFrame[]>([]);
  const [annotations, setAnnotations] = useState<CanvasAnnotation[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ type: "frame" | "annotation"; id: string } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [editingFrame, setEditingFrame] = useState<string | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "frame" | "annotation"; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCanvasData();
  }, [projectId]);

  const lastProcessedMsgCountRef = useRef(0);
  useEffect(() => {
    const canvasMessages = messages.filter(
      (m) => m.type === "canvas_frame_created" || m.type === "canvas_frame_updated" ||
             m.type === "canvas_annotation_created" || m.type === "canvas_annotation_updated"
    );
    if (canvasMessages.length > lastProcessedMsgCountRef.current) {
      lastProcessedMsgCountRef.current = canvasMessages.length;
      loadCanvasData();
    }
  }, [messages]);

  const loadCanvasData = async () => {
    try {
      setLoading(true);
      const [framesRes, annotationsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/canvas/frames`, { credentials: "include" }),
        fetch(`/api/projects/${projectId}/canvas/annotations`, { credentials: "include" }),
      ]);
      if (framesRes.ok) setFrames(await framesRes.json());
      if (annotationsRes.ok) setAnnotations(await annotationsRes.json());
    } catch (err) {
      console.error("Failed to load canvas data:", err);
    } finally {
      setLoading(false);
    }
  };

  const createFrame = async (x?: number, y?: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          name: "Untitled Frame",
          htmlContent: `<!DOCTYPE html>\n<html>\n<head><style>body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #1a1a2e; color: #fff; }</style></head>\n<body>\n<h1>New Frame</h1>\n</body>\n</html>`,
          x: x ?? Math.round((-panOffset.x + 200) / zoom),
          y: y ?? Math.round((-panOffset.y + 200) / zoom),
          width: 400,
          height: 300,
          zIndex: frames.length,
        }),
      });
      if (res.ok) {
        const frame = await res.json();
        setFrames(prev => [...prev, frame]);
      }
    } catch (err) {
      console.error("Failed to create frame:", err);
    }
  };

  const createAnnotation = async (type: "sticky" | "text" | "image") => {
    const colors: Record<string, string> = { sticky: "#FBBF24", text: "#60A5FA", image: "#34D399" };
    const defaults: Record<string, { w: number; h: number; content: string }> = {
      sticky: { w: 200, h: 150, content: "New note..." },
      text: { w: 200, h: 40, content: "Label" },
      image: { w: 300, h: 200, content: "" },
    };
    const d = defaults[type];
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/annotations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          type,
          content: d.content,
          x: Math.round((-panOffset.x + 300) / zoom),
          y: Math.round((-panOffset.y + 300) / zoom),
          width: d.w,
          height: d.h,
          color: colors[type],
          zIndex: annotations.length,
        }),
      });
      if (res.ok) {
        const annotation = await res.json();
        setAnnotations(prev => [...prev, annotation]);
      }
    } catch (err) {
      console.error("Failed to create annotation:", err);
    }
  };

  const updateFrame = async (id: string, data: Partial<CanvasFrame>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/frames/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setFrames(prev => prev.map(f => f.id === id ? updated : f));
      }
    } catch (err) {
      console.error("Failed to update frame:", err);
    }
  };

  const updateAnnotation = async (id: string, data: Partial<CanvasAnnotation>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/annotations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setAnnotations(prev => prev.map(a => a.id === id ? updated : a));
      }
    } catch (err) {
      console.error("Failed to update annotation:", err);
    }
  };

  const deleteFrame = async (id: string) => {
    try {
      await fetch(`/api/projects/${projectId}/canvas/frames/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
        credentials: "include",
      });
      setFrames(prev => prev.filter(f => f.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (err) {
      console.error("Failed to delete frame:", err);
    }
  };

  const deleteAnnotation = async (id: string) => {
    try {
      await fetch(`/api/projects/${projectId}/canvas/annotations/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
        credentials: "include",
      });
      setAnnotations(prev => prev.filter(a => a.id !== id));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (err) {
      console.error("Failed to delete annotation:", err);
    }
  };

  const duplicateFrame = async (id: string) => {
    const frame = frames.find(f => f.id === id);
    if (!frame) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/canvas/frames`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify({
          name: `${frame.name} (copy)`,
          htmlContent: frame.htmlContent,
          x: frame.x + 40,
          y: frame.y + 40,
          width: frame.width,
          height: frame.height,
          zIndex: frames.length,
        }),
      });
      if (res.ok) {
        const newFrame = await res.json();
        setFrames(prev => [...prev, newFrame]);
      }
    } catch (err) {
      console.error("Failed to duplicate frame:", err);
    }
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.shiftKey) {
      setPanOffset(prev => ({
        x: prev.x - e.deltaY,
        y: prev.y - e.deltaX,
      }));
    } else {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
    }
  }, []);

  const spacebarDownRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spacebarDownRef.current && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spacebarDownRef.current = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spacebarDownRef.current = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (toolMode === "pan" || e.shiftKey || spacebarDownRef.current))) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }
    if (e.button === 0 && e.target === canvasRef.current) {
      setSelectedItem(null);
      setContextMenu(null);
    }
  }, [panOffset, toolMode]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }
    if (dragState) {
      const dx = (e.clientX - dragState.startX) / zoom;
      const dy = (e.clientY - dragState.startY) / zoom;
      if (dragState.type === "move") {
        const newX = Math.round(dragState.originalX + dx);
        const newY = Math.round(dragState.originalY + dy);
        if (dragState.itemType === "frame") {
          setFrames(prev => prev.map(f => f.id === dragState.itemId ? { ...f, x: newX, y: newY } : f));
        } else {
          setAnnotations(prev => prev.map(a => a.id === dragState.itemId ? { ...a, x: newX, y: newY } : a));
        }
      } else if (dragState.type === "resize") {
        let newW = dragState.originalW;
        let newH = dragState.originalH;
        let newX = dragState.originalX;
        let newY = dragState.originalY;
        const dir = dragState.resizeDir || "se";
        if (dir.includes("e")) newW = Math.max(50, dragState.originalW + dx);
        if (dir.includes("s")) newH = Math.max(50, dragState.originalH + dy);
        if (dir.includes("w")) {
          const clampedDx = Math.min(dx, dragState.originalW - 50);
          newW = dragState.originalW - clampedDx;
          newX = dragState.originalX + clampedDx;
        }
        if (dir.includes("n")) {
          const clampedDy = Math.min(dy, dragState.originalH - 50);
          newH = dragState.originalH - clampedDy;
          newY = dragState.originalY + clampedDy;
        }
        const update = { x: Math.round(newX), y: Math.round(newY), width: Math.round(newW), height: Math.round(newH) };
        if (dragState.itemType === "frame") {
          setFrames(prev => prev.map(f => f.id === dragState.itemId ? { ...f, ...update } : f));
        } else {
          setAnnotations(prev => prev.map(a => a.id === dragState.itemId ? { ...a, ...update } : a));
        }
      }
    }
  }, [isPanning, panStart, dragState, zoom]);

  const handleCanvasMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (dragState) {
      if (dragState.itemType === "frame") {
        const frame = frames.find(f => f.id === dragState.itemId);
        if (frame) updateFrame(frame.id, { x: frame.x, y: frame.y, width: frame.width, height: frame.height });
      } else {
        const ann = annotations.find(a => a.id === dragState.itemId);
        if (ann) updateAnnotation(ann.id, { x: ann.x, y: ann.y, width: ann.width, height: ann.height });
      }
      setDragState(null);
    }
  }, [isPanning, dragState, frames, annotations]);

  const startDrag = (e: React.MouseEvent, itemType: "frame" | "annotation", itemId: string, type: "move" | "resize", resizeDir?: string) => {
    e.stopPropagation();
    e.preventDefault();
    const item = itemType === "frame" ? frames.find(f => f.id === itemId) : annotations.find(a => a.id === itemId);
    if (!item) return;
    setDragState({
      type,
      itemType,
      itemId,
      startX: e.clientX,
      startY: e.clientY,
      originalX: item.x,
      originalY: item.y,
      originalW: item.width,
      originalH: item.height,
      resizeDir,
    });
    setSelectedItem({ type: itemType, id: itemId });
  };

  const handleContextMenu = (e: React.MouseEvent, type: "frame" | "annotation", id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type, id });
    setSelectedItem({ type, id });
  };

  const zoomPercent = Math.round(zoom * 100);

  const gridPattern = useMemo(() => {
    if (!showGrid) return null;
    const size = GRID_SIZE * zoom;
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${size}px ${size}px`,
          backgroundPosition: `${panOffset.x % size}px ${panOffset.y % size}px`,
        }}
      />
    );
  }, [showGrid, zoom, panOffset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--ide-bg)]" data-testid="canvas-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#7C65CB]/20 flex items-center justify-center animate-pulse">
            <Frame className="w-4 h-4 text-[#7C65CB]" />
          </div>
          <span className="text-xs text-[var(--ide-text-muted)]">Loading canvas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d14] select-none" data-testid="design-canvas">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--ide-panel)] border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-0.5 mr-2">
          <button
            className={`p-1.5 rounded text-[11px] transition-colors ${toolMode === "select" ? "bg-[#7C65CB]/20 text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)]"}`}
            onClick={() => setToolMode("select")}
            title="Select mode (V)"
            data-testid="button-tool-select"
          >
            <Move className="w-3.5 h-3.5" />
          </button>
          <button
            className={`p-1.5 rounded text-[11px] transition-colors ${toolMode === "pan" ? "bg-[#7C65CB]/20 text-[#7C65CB]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)]"}`}
            onClick={() => setToolMode("pan")}
            title="Pan mode (H)"
            data-testid="button-tool-pan"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-[var(--ide-border)]" />

        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)] transition-colors"
          onClick={() => createFrame()}
          data-testid="button-add-frame"
        >
          <Frame className="w-3.5 h-3.5 text-[#0079F2]" />
          <span>Frame</span>
        </button>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)] transition-colors"
          onClick={() => createAnnotation("sticky")}
          data-testid="button-add-sticky"
        >
          <StickyNote className="w-3.5 h-3.5 text-[#FBBF24]" />
          <span>Sticky</span>
        </button>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)] transition-colors"
          onClick={() => createAnnotation("text")}
          data-testid="button-add-text"
        >
          <Type className="w-3.5 h-3.5 text-[#60A5FA]" />
          <span>Text</span>
        </button>
        <button
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)] transition-colors"
          onClick={() => createAnnotation("image")}
          data-testid="button-add-image"
        >
          <Image className="w-3.5 h-3.5 text-[#34D399]" />
          <span>Image</span>
        </button>

        <div className="w-px h-4 bg-[var(--ide-border)]" />

        <button
          className={`p-1.5 rounded transition-colors ${showGrid ? "bg-[var(--ide-hover)] text-[var(--ide-text)]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"}`}
          onClick={() => setShowGrid(prev => !prev)}
          title="Toggle grid"
          data-testid="button-toggle-grid"
        >
          <Grid3x3 className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1 bg-[var(--ide-surface)] rounded-md px-1 py-0.5">
          <button
            className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev - ZOOM_STEP))}
            data-testid="button-zoom-out"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            className="px-2 py-0.5 text-[10px] font-mono text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] rounded hover:bg-[var(--ide-hover)] min-w-[40px] text-center"
            onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}
            title="Reset zoom"
            data-testid="button-zoom-reset"
          >
            {zoomPercent}%
          </button>
          <button
            className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
            onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev + ZOOM_STEP))}
            data-testid="button-zoom-in"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <span className="text-[10px] text-[var(--ide-text-muted)] ml-2">
          {frames.length} frame{frames.length !== 1 ? "s" : ""} · {annotations.length} note{annotations.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: isPanning ? "grabbing" : toolMode === "pan" ? "grab" : "default" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onClick={() => setContextMenu(null)}
      >
        {gridPattern}

        <div
          ref={canvasRef}
          className="absolute"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
          data-testid="canvas-viewport"
        >
          {frames.map(frame => {
            const isSelected = selectedItem?.type === "frame" && selectedItem.id === frame.id;
            return (
              <div
                key={frame.id}
                className={`absolute group ${isSelected ? "ring-2 ring-[#0079F2]" : ""}`}
                style={{
                  left: frame.x,
                  top: frame.y,
                  width: frame.width,
                  height: frame.height + 28,
                  zIndex: frame.zIndex,
                }}
                onMouseDown={(e) => { if (toolMode === "select" && e.button === 0) startDrag(e, "frame", frame.id, "move"); }}
                onContextMenu={(e) => handleContextMenu(e, "frame", frame.id)}
                data-testid={`canvas-frame-${frame.id}`}
              >
                <div className="flex items-center gap-1.5 h-7 px-2 bg-[#1e1e2e] border border-b-0 border-[#333] rounded-t-md">
                  <Frame className="w-3 h-3 text-[#0079F2] shrink-0" />
                  {renameId === frame.id ? (
                    <input
                      autoFocus
                      className="flex-1 text-[10px] font-medium bg-transparent text-[var(--ide-text)] outline-none border-b border-[#0079F2]"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => { updateFrame(frame.id, { name: renameValue }); setRenameId(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { updateFrame(frame.id, { name: renameValue }); setRenameId(null); } if (e.key === "Escape") setRenameId(null); }}
                      onClick={e => e.stopPropagation()}
                      data-testid={`input-rename-frame-${frame.id}`}
                    />
                  ) : (
                    <span
                      className="flex-1 text-[10px] font-medium text-[var(--ide-text-secondary)] truncate cursor-text"
                      onDoubleClick={(e) => { e.stopPropagation(); setRenameId(frame.id); setRenameValue(frame.name); }}
                      data-testid={`text-frame-name-${frame.id}`}
                    >
                      {frame.name}
                    </span>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                    onClick={(e) => { e.stopPropagation(); deleteFrame(frame.id); }}
                    data-testid={`button-delete-frame-${frame.id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="relative bg-white rounded-b-md overflow-hidden border border-[#333]" style={{ width: frame.width, height: frame.height }}>
                  {editingFrame === frame.id ? (
                    <div className="absolute inset-0 z-10 flex flex-col bg-[#1e1e2e]">
                      <div className="flex items-center justify-between px-2 py-1 bg-[#0079F2]/10 border-b border-[#333]">
                        <span className="text-[10px] text-[#0079F2] font-medium">Editing HTML</span>
                        <button
                          className="p-0.5 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-muted)]"
                          onClick={(e) => { e.stopPropagation(); setEditingFrame(null); }}
                          data-testid={`button-close-editor-${frame.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <textarea
                        className="flex-1 p-2 bg-[#1e1e2e] text-[11px] font-mono text-[var(--ide-text)] resize-none outline-none"
                        value={frame.htmlContent}
                        onChange={(e) => setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, htmlContent: e.target.value } : f))}
                        onBlur={() => updateFrame(frame.id, { htmlContent: frame.htmlContent })}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        data-testid={`textarea-html-${frame.id}`}
                      />
                    </div>
                  ) : null}
                  <iframe
                    srcDoc={frame.htmlContent}
                    className="w-full h-full border-0"
                    sandbox="allow-scripts"
                    title={frame.name}
                    style={{ pointerEvents: isSelected ? "auto" : "none" }}
                    data-testid={`iframe-frame-${frame.id}`}
                  />
                </div>

                {isSelected && (
                  <>
                    {["se", "sw", "ne", "nw", "e", "w", "s", "n"].map(dir => {
                      const pos: Record<string, React.CSSProperties> = {
                        se: { right: -4, bottom: -4, cursor: "se-resize" },
                        sw: { left: -4, bottom: -4, cursor: "sw-resize" },
                        ne: { right: -4, top: -4, cursor: "ne-resize" },
                        nw: { left: -4, top: -4, cursor: "nw-resize" },
                        e: { right: -4, top: "50%", transform: "translateY(-50%)", cursor: "e-resize" },
                        w: { left: -4, top: "50%", transform: "translateY(-50%)", cursor: "w-resize" },
                        s: { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" },
                        n: { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" },
                      };
                      return (
                        <div
                          key={dir}
                          className="absolute w-2 h-2 bg-[#0079F2] rounded-sm border border-white"
                          style={pos[dir]}
                          onMouseDown={(e) => startDrag(e, "frame", frame.id, "resize", dir)}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}

          {annotations.map(ann => {
            const isSelected = selectedItem?.type === "annotation" && selectedItem.id === ann.id;
            return (
              <div
                key={ann.id}
                className={`absolute group ${isSelected ? "ring-2 ring-[#0079F2]" : ""}`}
                style={{
                  left: ann.x,
                  top: ann.y,
                  width: ann.width,
                  height: ann.height,
                  zIndex: ann.zIndex,
                }}
                onMouseDown={(e) => { if (toolMode === "select" && e.button === 0) startDrag(e, "annotation", ann.id, "move"); }}
                onContextMenu={(e) => handleContextMenu(e, "annotation", ann.id)}
                data-testid={`canvas-annotation-${ann.id}`}
              >
                {ann.type === "sticky" && (
                  <div
                    className="w-full h-full rounded-md shadow-lg p-3 overflow-hidden"
                    style={{ backgroundColor: ann.color + "30", border: `1px solid ${ann.color}50` }}
                  >
                    {editingAnnotation === ann.id ? (
                      <textarea
                        autoFocus
                        className="w-full h-full bg-transparent text-[12px] text-[var(--ide-text)] resize-none outline-none"
                        value={ann.content}
                        onChange={(e) => setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, content: e.target.value } : a))}
                        onBlur={() => { updateAnnotation(ann.id, { content: ann.content }); setEditingAnnotation(null); }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        data-testid={`textarea-annotation-${ann.id}`}
                      />
                    ) : (
                      <div
                        className="text-[12px] text-[var(--ide-text)] whitespace-pre-wrap cursor-text h-full"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingAnnotation(ann.id); }}
                        data-testid={`text-annotation-content-${ann.id}`}
                      >
                        {ann.content || "Double-click to edit..."}
                      </div>
                    )}
                    <button
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 text-[var(--ide-text-muted)] hover:text-red-400 transition-all"
                      onClick={(e) => { e.stopPropagation(); deleteAnnotation(ann.id); }}
                      data-testid={`button-delete-annotation-${ann.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {ann.type === "text" && (
                  <div className="w-full h-full flex items-center">
                    {editingAnnotation === ann.id ? (
                      <input
                        autoFocus
                        className="w-full bg-transparent text-[14px] font-medium text-[var(--ide-text)] outline-none border-b border-[#60A5FA]"
                        value={ann.content}
                        onChange={(e) => setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, content: e.target.value } : a))}
                        onBlur={() => { updateAnnotation(ann.id, { content: ann.content }); setEditingAnnotation(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { updateAnnotation(ann.id, { content: ann.content }); setEditingAnnotation(null); } }}
                        onClick={e => e.stopPropagation()}
                        onMouseDown={e => e.stopPropagation()}
                        data-testid={`input-annotation-text-${ann.id}`}
                      />
                    ) : (
                      <span
                        className="text-[14px] font-medium text-[var(--ide-text)] cursor-text"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingAnnotation(ann.id); }}
                        data-testid={`text-annotation-label-${ann.id}`}
                      >
                        {ann.content || "Label"}
                      </span>
                    )}
                  </div>
                )}

                {ann.type === "image" && (
                  <div
                    className="w-full h-full rounded-md border border-[var(--ide-border)] bg-[var(--ide-surface)] flex items-center justify-center overflow-hidden"
                  >
                    {editingAnnotation === ann.id ? (
                      <div className="p-2 w-full">
                        <label className="text-[10px] text-[var(--ide-text-muted)] mb-1 block">Image URL</label>
                        <input
                          autoFocus
                          className="w-full bg-[var(--ide-bg)] text-[12px] text-[var(--ide-text)] outline-none border border-[var(--ide-border)] rounded px-2 py-1"
                          placeholder="https://example.com/image.png"
                          value={ann.content}
                          onChange={(e) => setAnnotations(prev => prev.map(a => a.id === ann.id ? { ...a, content: e.target.value } : a))}
                          onBlur={() => { updateAnnotation(ann.id, { content: ann.content }); setEditingAnnotation(null); }}
                          onKeyDown={e => { if (e.key === "Enter") { updateAnnotation(ann.id, { content: ann.content }); setEditingAnnotation(null); } }}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          data-testid={`input-annotation-image-url-${ann.id}`}
                        />
                      </div>
                    ) : ann.content ? (
                      <img
                        src={ann.content}
                        alt=""
                        className="w-full h-full object-cover"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingAnnotation(ann.id); }}
                      />
                    ) : (
                      <div
                        className="text-center cursor-pointer"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingAnnotation(ann.id); }}
                      >
                        <Image className="w-6 h-6 text-[var(--ide-text-muted)] mx-auto mb-1" />
                        <span className="text-[10px] text-[var(--ide-text-muted)]">Double-click to set URL</span>
                      </div>
                    )}
                  </div>
                )}

                {isSelected && (
                  <>
                    {["se", "sw", "ne", "nw"].map(dir => {
                      const pos: Record<string, React.CSSProperties> = {
                        se: { right: -4, bottom: -4, cursor: "se-resize" },
                        sw: { left: -4, bottom: -4, cursor: "sw-resize" },
                        ne: { right: -4, top: -4, cursor: "ne-resize" },
                        nw: { left: -4, top: -4, cursor: "nw-resize" },
                      };
                      return (
                        <div
                          key={dir}
                          className="absolute w-2 h-2 bg-[#0079F2] rounded-sm border border-white"
                          style={pos[dir]}
                          onMouseDown={(e) => startDrag(e, "annotation", ann.id, "resize", dir)}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {contextMenu && (
          <div
            className="fixed z-[9999] bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={e => e.stopPropagation()}
            data-testid="canvas-context-menu"
          >
            {contextMenu.type === "frame" && (
              <>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)] hover:text-[var(--ide-text)]"
                  onClick={() => {
                    const f = frames.find(f => f.id === contextMenu.id);
                    if (f) { setRenameId(f.id); setRenameValue(f.name); }
                    setContextMenu(null);
                  }}
                  data-testid="button-ctx-rename"
                >
                  <Pencil className="w-3 h-3" /> Rename
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)] hover:text-[var(--ide-text)]"
                  onClick={() => { setEditingFrame(contextMenu.id); setContextMenu(null); }}
                  data-testid="button-ctx-edit-html"
                >
                  <Type className="w-3 h-3" /> Edit HTML
                </button>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)] hover:text-[var(--ide-text)]"
                  onClick={() => { duplicateFrame(contextMenu.id); setContextMenu(null); }}
                  data-testid="button-ctx-duplicate"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <div className="h-px bg-[var(--ide-border)] my-1" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10"
                  onClick={() => { deleteFrame(contextMenu.id); setContextMenu(null); }}
                  data-testid="button-ctx-delete"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </>
            )}
            {contextMenu.type === "annotation" && (
              <>
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[var(--ide-text-secondary)] hover:bg-[var(--ide-hover)] hover:text-[var(--ide-text)]"
                  onClick={() => { setEditingAnnotation(contextMenu.id); setContextMenu(null); }}
                  data-testid="button-ctx-edit-annotation"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <div className="h-px bg-[var(--ide-border)] my-1" />
                <button
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10"
                  onClick={() => { deleteAnnotation(contextMenu.id); setContextMenu(null); }}
                  data-testid="button-ctx-delete-annotation"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </>
            )}
          </div>
        )}

        {frames.length === 0 && annotations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-testid="canvas-empty-state">
            <div className="text-center pointer-events-auto">
              <div className="w-16 h-16 rounded-2xl bg-[#7C65CB]/10 flex items-center justify-center mx-auto mb-4">
                <Frame className="w-8 h-8 text-[#7C65CB]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-1">Design Canvas</h3>
              <p className="text-[12px] text-[var(--ide-text-muted)] mb-4 max-w-[280px]">
                Create frames to mockup designs, add sticky notes for annotations,
                and compare design variants side by side.
              </p>
              <div className="flex items-center gap-2 justify-center">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0079F2] hover:bg-[#0066CC] text-white text-[11px] font-medium transition-colors"
                  onClick={() => createFrame()}
                  data-testid="button-create-first-frame"
                >
                  <Plus className="w-3 h-3" /> Add Frame
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--ide-surface)] hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)] text-[11px] font-medium transition-colors border border-[var(--ide-border)]"
                  onClick={() => createAnnotation("sticky")}
                  data-testid="button-create-first-note"
                >
                  <StickyNote className="w-3 h-3" /> Add Note
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
