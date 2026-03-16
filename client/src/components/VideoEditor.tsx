import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus, Trash2, Play, Pause, Square, ChevronLeft, ChevronRight,
  Type, Image, Layers, Music, Settings, Loader2, Film, X,
  Copy, MoveHorizontal, Volume2, VolumeX, Clock, Maximize2, Download
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VideoScene, VideoElement, VideoAudioTrack } from "@shared/schema";

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

const TRANSITIONS: VideoScene["transition"][] = ["none", "fade", "slide-left", "slide-right", "zoom", "dissolve"];

function createDefaultScene(order: number): VideoScene {
  return {
    id: generateId(),
    order,
    duration: 5,
    backgroundColor: "#1a1a2e",
    elements: [
      {
        id: generateId(),
        type: "text",
        content: order === 0 ? "Your Video Title" : `Scene ${order + 1}`,
        x: 10, y: 35, width: 80, height: 30,
        startTime: 0, endTime: 5,
        style: { fontSize: "48", fontWeight: "bold", color: "#ffffff", textAlign: "center" },
        animation: "fade-in",
      },
    ],
    transition: "fade",
  };
}

interface VideoEditorProps {
  projectId: string;
}

export default function VideoEditor({ projectId }: VideoEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [activePanel, setActivePanel] = useState<"properties" | "audio">("properties");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const prevSceneRef = useRef<ImageData | null>(null);
  const transitionProgressRef = useRef<number>(0);
  const prevSceneIndexRef = useRef<number>(0);

  const videoQuery = useQuery<{ scenes: VideoScene[]; audioTracks: VideoAudioTrack[]; resolution: { width: number; height: number }; fps: number }>({
    queryKey: [`/api/projects/${projectId}/video`],
  });

  const [localScenes, setLocalScenes] = useState<VideoScene[]>([]);
  const [localAudioTracks, setLocalAudioTracks] = useState<VideoAudioTrack[]>([]);
  const [resolution, setResolution] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    if (videoQuery.data) {
      const scenes = videoQuery.data.scenes?.length > 0 ? videoQuery.data.scenes : [createDefaultScene(0)];
      setLocalScenes(scenes);
      if (videoQuery.data.audioTracks) setLocalAudioTracks(videoQuery.data.audioTracks);
      if (videoQuery.data.resolution) setResolution(videoQuery.data.resolution);
    }
  }, [videoQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (data: { scenes: VideoScene[]; audioTracks: VideoAudioTrack[] }) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/video`, { ...data, resolution });
      return res.json();
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/video`] });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const save = useCallback(() => {
    saveMutation.mutate({ scenes: localScenes, audioTracks: localAudioTracks });
  }, [localScenes, localAudioTracks, saveMutation]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => save(), 2000);
    return () => clearTimeout(timer);
  }, [isDirty, save]);

  const updateScenes = useCallback((updater: (scenes: VideoScene[]) => VideoScene[]) => {
    setLocalScenes(prev => {
      const next = updater(prev);
      setIsDirty(true);
      return next;
    });
  }, []);

  const totalDuration = useMemo(() => localScenes.reduce((sum, s) => sum + s.duration, 0), [localScenes]);

  const addScene = useCallback(() => {
    updateScenes(scenes => {
      const newScene = createDefaultScene(scenes.length);
      setSelectedSceneIndex(scenes.length);
      return [...scenes, newScene];
    });
  }, [updateScenes]);

  const deleteScene = useCallback((index: number) => {
    updateScenes(scenes => {
      if (scenes.length <= 1) return scenes;
      const next = scenes.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }));
      if (selectedSceneIndex >= next.length) setSelectedSceneIndex(Math.max(0, next.length - 1));
      return next;
    });
  }, [selectedSceneIndex, updateScenes]);

  const duplicateScene = useCallback((index: number) => {
    updateScenes(scenes => {
      const dup: VideoScene = {
        ...JSON.parse(JSON.stringify(scenes[index])),
        id: generateId(),
      };
      dup.elements = dup.elements.map((el: VideoElement) => ({ ...el, id: generateId() }));
      const next = [...scenes.slice(0, index + 1), dup, ...scenes.slice(index + 1)].map((s, i) => ({ ...s, order: i }));
      setSelectedSceneIndex(index + 1);
      return next;
    });
  }, [updateScenes]);

  const updateSceneProp = useCallback(<K extends keyof VideoScene>(key: K, value: VideoScene[K]) => {
    updateScenes(scenes =>
      scenes.map((s, i) => i === selectedSceneIndex ? { ...s, [key]: value } : s)
    );
  }, [selectedSceneIndex, updateScenes]);

  const addElement = useCallback((type: VideoElement["type"]) => {
    const defaults: Record<string, Partial<VideoElement>> = {
      text: { content: "New Text", x: 30, y: 40, width: 40, height: 15, style: { fontSize: "32", color: "#ffffff", fontWeight: "normal" } },
      image: { content: "", x: 20, y: 20, width: 60, height: 50 },
      shape: { content: "rectangle", x: 30, y: 30, width: 40, height: 30, style: { backgroundColor: "#0079F2", borderRadius: "8" } },
      overlay: { content: "", x: 0, y: 0, width: 100, height: 100, style: { backgroundColor: "rgba(0,0,0,0.3)" } },
    };
    const scene = localScenes[selectedSceneIndex];
    if (!scene) return;
    const el: VideoElement = {
      id: generateId(),
      type,
      startTime: 0,
      endTime: scene.duration,
      animation: "none",
      ...defaults[type],
    } as VideoElement;
    updateScenes(scenes =>
      scenes.map((s, i) => i === selectedSceneIndex ? { ...s, elements: [...s.elements, el] } : s)
    );
    setSelectedElementId(el.id);
  }, [localScenes, selectedSceneIndex, updateScenes]);

  const updateElement = useCallback((elementId: string, updates: Partial<VideoElement>) => {
    updateScenes(scenes =>
      scenes.map((s, i) => i === selectedSceneIndex
        ? { ...s, elements: s.elements.map(el => el.id === elementId ? { ...el, ...updates } : el) }
        : s
      )
    );
  }, [selectedSceneIndex, updateScenes]);

  const deleteElement = useCallback((elementId: string) => {
    updateScenes(scenes =>
      scenes.map((s, i) => i === selectedSceneIndex
        ? { ...s, elements: s.elements.filter(el => el.id !== elementId) }
        : s
      )
    );
    setSelectedElementId(null);
  }, [selectedSceneIndex, updateScenes]);

  const addAudioTrack = useCallback(() => {
    const track: VideoAudioTrack = {
      id: generateId(),
      name: `Track ${localAudioTracks.length + 1}`,
      url: "",
      startTime: 0,
      duration: totalDuration,
      volume: 1,
    };
    setLocalAudioTracks(prev => [...prev, track]);
    setIsDirty(true);
  }, [localAudioTracks.length, totalDuration]);

  const updateAudioTrack = useCallback((trackId: string, updates: Partial<VideoAudioTrack>) => {
    setLocalAudioTracks(prev =>
      prev.map(t => t.id === trackId ? { ...t, ...updates } : t)
    );
    setIsDirty(true);
  }, []);

  const deleteAudioTrack = useCallback((trackId: string) => {
    setLocalAudioTracks(prev => prev.filter(t => t.id !== trackId));
    setIsDirty(true);
  }, []);

  const currentScene = localScenes[selectedSceneIndex];

  const renderSceneToCanvas = useCallback((ctx: CanvasRenderingContext2D, scene: VideoScene, w: number, h: number, sceneTime: number) => {
    ctx.fillStyle = scene.backgroundColor;
    ctx.fillRect(0, 0, w, h);

    for (const el of scene.elements) {
      const elVisible = sceneTime >= el.startTime && sceneTime <= el.endTime;
      if (!elVisible) continue;

      const elX = (el.x / 100) * w;
      const elY = (el.y / 100) * h;
      const elW = (el.width / 100) * w;
      const elH = (el.height / 100) * h;

      ctx.save();

      const animDuration = 0.5;
      const elLocalTime = sceneTime - el.startTime;
      const animProgress = Math.min(1, elLocalTime / animDuration);
      const eased = 1 - Math.pow(1 - animProgress, 3);

      if (el.animation === "fade-in") {
        ctx.globalAlpha = eased;
      } else if (el.animation === "slide-up") {
        const offsetY = (1 - eased) * h * 0.1;
        ctx.translate(0, offsetY);
        ctx.globalAlpha = eased;
      } else if (el.animation === "scale") {
        const scale = 0.5 + eased * 0.5;
        ctx.translate(elX + elW / 2, elY + elH / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(elX + elW / 2), -(elY + elH / 2));
        ctx.globalAlpha = eased;
      } else if (el.animation === "typewriter" && el.type === "text") {
        const charCount = Math.floor(el.content.length * eased);
        const fontSize = parseInt(el.style?.fontSize || "32") * (w / 960);
        ctx.font = `${el.style?.fontWeight || "normal"} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = el.style?.color || "#ffffff";
        ctx.textAlign = (el.style?.textAlign as CanvasTextAlign) || "center";
        ctx.textBaseline = "middle";
        ctx.fillText(el.content.slice(0, charCount), elX + elW / 2, elY + elH / 2);
        ctx.restore();
        continue;
      }

      if (el.type === "text") {
        const fontSize = parseInt(el.style?.fontSize || "32") * (w / 960);
        ctx.font = `${el.style?.fontWeight || "normal"} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = el.style?.color || "#ffffff";
        ctx.textAlign = (el.style?.textAlign as CanvasTextAlign) || "center";
        ctx.textBaseline = "middle";
        const lines = el.content.split("\n");
        lines.forEach((line, i) => {
          ctx.fillText(line, elX + elW / 2, elY + elH / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.3);
        });
      } else if (el.type === "shape") {
        ctx.fillStyle = el.style?.backgroundColor || "#0079F2";
        const radius = parseInt(el.style?.borderRadius || "0") * (w / 960);
        ctx.beginPath();
        ctx.roundRect(elX, elY, elW, elH, radius);
        ctx.fill();
      } else if (el.type === "overlay") {
        ctx.fillStyle = el.style?.backgroundColor || "rgba(0,0,0,0.3)";
        ctx.fillRect(elX, elY, elW, elH);
      } else if (el.type === "image" && el.content) {
        ctx.fillStyle = "#333";
        ctx.fillRect(elX, elY, elW, elH);
        ctx.font = `12px Inter, system-ui, sans-serif`;
        ctx.fillStyle = "#aaa";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🖼 " + (el.content.length > 30 ? el.content.substring(0, 30) + "..." : el.content), elX + elW / 2, elY + elH / 2);
      }

      ctx.restore();
    }
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentScene) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    let sceneLocalTime = currentTime;
    let accumulated = 0;
    let activeSceneIdx = selectedSceneIndex;
    for (let i = 0; i < localScenes.length; i++) {
      if (currentTime < accumulated + localScenes[i].duration) {
        activeSceneIdx = i;
        sceneLocalTime = currentTime - accumulated;
        break;
      }
      accumulated += localScenes[i].duration;
    }

    const activeScene = localScenes[activeSceneIdx];
    if (!activeScene) return;

    const transitionDuration = 0.4;
    const transition = activeScene.transition || "none";
    const isInTransition = isPlaying && activeSceneIdx > 0 && sceneLocalTime < transitionDuration && transition !== "none";

    if (isInTransition) {
      const prevScene = localScenes[activeSceneIdx - 1];
      const progress = sceneLocalTime / transitionDuration;
      const eased = progress * progress * (3 - 2 * progress);

      const offCanvas = document.createElement("canvas");
      offCanvas.width = w;
      offCanvas.height = h;
      const offCtx = offCanvas.getContext("2d")!;
      renderSceneToCanvas(offCtx, prevScene, w, h, prevScene.duration);

      const curCanvas = document.createElement("canvas");
      curCanvas.width = w;
      curCanvas.height = h;
      const curCtx = curCanvas.getContext("2d")!;
      renderSceneToCanvas(curCtx, activeScene, w, h, sceneLocalTime);

      ctx.clearRect(0, 0, w, h);

      if (transition === "fade" || transition === "dissolve") {
        ctx.globalAlpha = 1;
        ctx.drawImage(offCanvas, 0, 0);
        ctx.globalAlpha = eased;
        ctx.drawImage(curCanvas, 0, 0);
        ctx.globalAlpha = 1;
      } else if (transition === "slide-left") {
        ctx.drawImage(offCanvas, -w * eased, 0);
        ctx.drawImage(curCanvas, w * (1 - eased), 0);
      } else if (transition === "slide-right") {
        ctx.drawImage(offCanvas, w * eased, 0);
        ctx.drawImage(curCanvas, -w * (1 - eased), 0);
      } else if (transition === "zoom") {
        const scale = 1 + eased * 0.3;
        ctx.globalAlpha = 1 - eased;
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);
        ctx.drawImage(offCanvas, 0, 0);
        ctx.restore();
        ctx.globalAlpha = eased;
        ctx.drawImage(curCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
    } else {
      renderSceneToCanvas(ctx, activeScene, w, h, isPlaying ? sceneLocalTime : 0);
    }

    if (selectedElementId && !isPlaying) {
      const el = currentScene.elements.find(e => e.id === selectedElementId);
      if (el) {
        const elX = (el.x / 100) * w;
        const elY = (el.y / 100) * h;
        const elW = (el.width / 100) * w;
        const elH = (el.height / 100) * h;
        ctx.strokeStyle = "#0079F2";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(elX, elY, elW, elH);
        ctx.setLineDash([]);
        const handleSize = 6;
        ctx.fillStyle = "#0079F2";
        [[elX, elY], [elX + elW, elY], [elX, elY + elH], [elX + elW, elY + elH]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
        });
      }
    }
  }, [currentScene, selectedElementId, currentTime, isPlaying, localScenes, selectedSceneIndex, renderSceneToCanvas]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current);
      return;
    }
    startTimeRef.current = performance.now() - currentTime * 1000;
    const animate = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      if (elapsed >= totalDuration) {
        setIsPlaying(false);
        setCurrentTime(0);
        setSelectedSceneIndex(0);
        return;
      }
      setCurrentTime(elapsed);
      let accumulated = 0;
      for (let i = 0; i < localScenes.length; i++) {
        if (elapsed < accumulated + localScenes[i].duration) {
          if (i !== selectedSceneIndex) setSelectedSceneIndex(i);
          break;
        }
        accumulated += localScenes[i].duration;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying]);

  const selectedElement = currentScene?.elements.find(e => e.id === selectedElementId);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  if (videoQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--ide-bg)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--ide-text-secondary)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--ide-bg)]" data-testid="video-editor">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-panel)]">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-[var(--ide-text-secondary)]" />
          <span className="text-sm font-medium text-[var(--ide-text)]">Video Editor</span>
          <span className="text-xs text-[var(--ide-text-secondary)]">{localScenes.length} scenes • {formatTime(totalDuration)}</span>
          {isDirty && <span className="text-xs text-amber-400">• unsaved</span>}
          {saveMutation.isPending && <Loader2 className="w-3 h-3 animate-spin text-[var(--ide-text-secondary)]" />}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={save} disabled={!isDirty || saveMutation.isPending} data-testid="button-save-video">
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { window.open(`/api/projects/${projectId}/video/export`, '_blank'); }} data-testid="button-export-video">
            <Download className="w-3.5 h-3.5" /> Export MP4
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 bg-[#0a0a0a]">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              style={{ aspectRatio: "16/9" }}
              onClick={(e) => {
                if (isPlaying) return;
                const rect = canvasRef.current!.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                const clickedEl = currentScene?.elements.findLast(el =>
                  x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height
                );
                setSelectedElementId(clickedEl?.id || null);
              }}
              data-testid="video-canvas"
            />
          </div>

          <div className="border-t border-[var(--ide-border)] bg-[var(--ide-panel)] p-2">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => { if (isPlaying) { setIsPlaying(false); } else { if (currentTime >= totalDuration) setCurrentTime(0); setIsPlaying(true); } }} className="p-1.5 rounded bg-[#0079F2] text-white hover:bg-[#0066CC]" data-testid="button-play-pause">
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => { setIsPlaying(false); setCurrentTime(0); setSelectedSceneIndex(0); }} className="p-1.5 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" data-testid="button-stop">
                <Square className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-[var(--ide-text-secondary)] min-w-[90px]">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
              <div className="flex-1 h-2 bg-[var(--ide-surface)] rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                const newTime = Math.max(0, Math.min(totalDuration, pct * totalDuration));
                setCurrentTime(newTime);
                let acc = 0;
                for (let i = 0; i < localScenes.length; i++) {
                  if (newTime < acc + localScenes[i].duration) { setSelectedSceneIndex(i); break; }
                  acc += localScenes[i].duration;
                }
              }} data-testid="video-timeline-scrubber">
                <div className="h-full bg-[#0079F2] rounded-full transition-all" style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1" data-testid="video-timeline">
              {localScenes.map((scene, index) => (
                <div
                  key={scene.id}
                  onClick={() => { setSelectedSceneIndex(index); setSelectedElementId(null); }}
                  className={`flex-shrink-0 rounded-lg border-2 p-2 cursor-pointer transition-all ${index === selectedSceneIndex ? "border-[#0079F2] bg-[#0079F2]/10" : "border-[var(--ide-border)] hover:border-[var(--ide-border-hover)]"}`}
                  style={{ width: Math.max(80, scene.duration * 30) }}
                  data-testid={`scene-block-${index}`}
                >
                  <div className="text-[9px] font-semibold text-[var(--ide-text-secondary)] mb-0.5">Scene {index + 1}</div>
                  <div className="text-[8px] text-[var(--ide-text-secondary)]">{scene.duration}s • {scene.transition}</div>
                  <div className="flex gap-0.5 mt-1">
                    {scene.elements.slice(0, 4).map(el => (
                      <div key={el.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: el.type === "text" ? "#0079F2" : el.type === "shape" ? "#0CCE6B" : el.type === "image" ? "#f59e0b" : "#7C65CB" }} />
                    ))}
                    {scene.elements.length > 4 && <span className="text-[7px] text-[var(--ide-text-secondary)]">+{scene.elements.length - 4}</span>}
                  </div>
                </div>
              ))}
              <button onClick={addScene} className="flex-shrink-0 w-16 h-full border-2 border-dashed border-[var(--ide-border)] rounded-lg flex items-center justify-center text-[var(--ide-text-secondary)] hover:border-[#0079F2] hover:text-[#0079F2]" data-testid="button-add-scene">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-[280px] border-l border-[var(--ide-border)] bg-[var(--ide-panel)] flex flex-col" data-testid="video-properties">
          <div className="flex border-b border-[var(--ide-border)]">
            <button
              onClick={() => setActivePanel("properties")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${activePanel === "properties" ? "text-[#0079F2] border-b-2 border-[#0079F2]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"}`}
              data-testid="tab-properties"
            >
              <Settings className="w-3 h-3 inline mr-1" />Properties
            </button>
            <button
              onClick={() => setActivePanel("audio")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${activePanel === "audio" ? "text-[#0079F2] border-b-2 border-[#0079F2]" : "text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]"}`}
              data-testid="tab-audio"
            >
              <Music className="w-3 h-3 inline mr-1" />Audio ({localAudioTracks.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activePanel === "properties" && currentScene && (
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-2">Scene Properties</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--ide-text-secondary)]">Duration</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={currentScene.duration}
                          onChange={e => updateSceneProp("duration", Math.max(0.5, parseFloat(e.target.value) || 1))}
                          className="w-14 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)] text-center"
                          min={0.5}
                          max={120}
                          step={0.5}
                          data-testid="input-scene-duration"
                        />
                        <span className="text-[10px] text-[var(--ide-text-secondary)]">sec</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--ide-text-secondary)]">Background</span>
                      <input
                        type="color"
                        value={currentScene.backgroundColor}
                        onChange={e => updateSceneProp("backgroundColor", e.target.value)}
                        className="w-8 h-6 rounded border border-[var(--ide-border)] cursor-pointer"
                        data-testid="input-scene-bg-color"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--ide-text-secondary)]">Transition</span>
                      <select
                        value={currentScene.transition}
                        onChange={e => updateSceneProp("transition", e.target.value as VideoScene["transition"])}
                        className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                        data-testid="select-scene-transition"
                      >
                        {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-1 mt-2">
                    <button onClick={() => duplicateScene(selectedSceneIndex)} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Duplicate" data-testid="button-duplicate-scene"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteScene(selectedSceneIndex)} disabled={localScenes.length <= 1} className="p-1 rounded hover:bg-[var(--ide-hover)] text-red-400 disabled:opacity-30" title="Delete" data-testid="button-delete-scene"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="border-t border-[var(--ide-border)] pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Elements</span>
                    <div className="flex gap-1">
                      <button onClick={() => addElement("text")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Text" data-testid="button-add-text-element"><Type className="w-3 h-3" /></button>
                      <button onClick={() => addElement("shape")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Shape" data-testid="button-add-shape-element"><Layers className="w-3 h-3" /></button>
                      <button onClick={() => addElement("image")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Image" data-testid="button-add-image-element"><Image className="w-3 h-3" /></button>
                      <button onClick={() => addElement("overlay")} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Overlay" data-testid="button-add-overlay-element"><Layers className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {currentScene.elements.map(el => (
                      <div
                        key={el.id}
                        onClick={() => setSelectedElementId(el.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${selectedElementId === el.id ? "bg-[#0079F2]/10 border border-[#0079F2]/30" : "hover:bg-[var(--ide-hover)]"}`}
                        data-testid={`element-item-${el.id}`}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: el.type === "text" ? "#0079F2" : el.type === "shape" ? "#0CCE6B" : el.type === "image" ? "#f59e0b" : "#7C65CB" }} />
                        <span className="text-xs text-[var(--ide-text)] flex-1 truncate">{el.type === "text" ? el.content.slice(0, 20) : el.type}</span>
                        <span className="text-[8px] text-[var(--ide-text-secondary)]">{el.startTime}s-{el.endTime}s</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-[var(--ide-text-secondary)] hover:text-red-400" data-testid={`button-delete-element-${el.id}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {currentScene.elements.length === 0 && (
                      <div className="text-xs text-[var(--ide-text-secondary)] text-center py-4 opacity-60">No elements. Add text, shapes, or images above.</div>
                    )}
                  </div>
                </div>

                {selectedElement && (
                  <div className="border-t border-[var(--ide-border)] pt-3">
                    <div className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider mb-2">Element Properties</div>
                    <div className="space-y-2">
                      {(selectedElement.type === "text" || selectedElement.type === "image") && (
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">{selectedElement.type === "text" ? "Text" : "Image URL"}</span>
                          <textarea
                            value={selectedElement.content}
                            onChange={e => updateElement(selectedElement.id, { content: e.target.value })}
                            placeholder={selectedElement.type === "image" ? "https://example.com/image.jpg" : "Enter text..."}
                            className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] resize-none mt-0.5"
                            rows={selectedElement.type === "image" ? 1 : 2}
                            data-testid="input-element-text"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">X (%)</span>
                          <input type="number" value={selectedElement.x} onChange={e => updateElement(selectedElement.id, { x: Number(e.target.value) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={0} max={100} data-testid="input-element-x" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">Y (%)</span>
                          <input type="number" value={selectedElement.y} onChange={e => updateElement(selectedElement.id, { y: Number(e.target.value) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={0} max={100} data-testid="input-element-y" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">Width (%)</span>
                          <input type="number" value={selectedElement.width} onChange={e => updateElement(selectedElement.id, { width: Number(e.target.value) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={1} max={100} data-testid="input-element-width" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">Height (%)</span>
                          <input type="number" value={selectedElement.height} onChange={e => updateElement(selectedElement.id, { height: Number(e.target.value) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={1} max={100} data-testid="input-element-height" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">Start (s)</span>
                          <input type="number" value={selectedElement.startTime} onChange={e => updateElement(selectedElement.id, { startTime: Math.max(0, Number(e.target.value)) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={0} step={0.1} data-testid="input-element-start" />
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">End (s)</span>
                          <input type="number" value={selectedElement.endTime} onChange={e => updateElement(selectedElement.id, { endTime: Math.max(0, Number(e.target.value)) })} className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]" min={0} step={0.1} data-testid="input-element-end" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[var(--ide-text-secondary)]">Animation</span>
                        <select
                          value={selectedElement.animation || "none"}
                          onChange={e => updateElement(selectedElement.id, { animation: e.target.value as VideoElement["animation"] })}
                          className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                          data-testid="select-element-animation"
                        >
                          <option value="none">None</option>
                          <option value="fade-in">Fade In</option>
                          <option value="slide-up">Slide Up</option>
                          <option value="scale">Scale</option>
                          <option value="typewriter">Typewriter</option>
                        </select>
                      </div>
                      {selectedElement.type === "text" && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Color</span>
                            <input
                              type="color"
                              value={selectedElement.style?.color || "#ffffff"}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, color: e.target.value } })}
                              className="w-8 h-6 rounded border border-[var(--ide-border)] cursor-pointer"
                              data-testid="input-element-color"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Font Size</span>
                            <input
                              type="number"
                              value={parseInt(selectedElement.style?.fontSize || "32")}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontSize: e.target.value } })}
                              className="w-14 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)] text-center"
                              min={8}
                              max={200}
                              data-testid="input-element-font-size"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Weight</span>
                            <select
                              value={selectedElement.style?.fontWeight || "normal"}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontWeight: e.target.value } })}
                              className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                              data-testid="select-element-weight"
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Align</span>
                            <select
                              value={selectedElement.style?.textAlign || "center"}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, textAlign: e.target.value } })}
                              className="bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                              data-testid="select-element-align"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </>
                      )}
                      {selectedElement.type === "shape" && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Fill Color</span>
                            <input
                              type="color"
                              value={selectedElement.style?.backgroundColor || "#0079F2"}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, backgroundColor: e.target.value } })}
                              className="w-8 h-6 rounded border border-[var(--ide-border)] cursor-pointer"
                              data-testid="input-element-fill"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[var(--ide-text-secondary)]">Border Radius</span>
                            <input
                              type="number"
                              value={parseInt(selectedElement.style?.borderRadius || "0")}
                              onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, borderRadius: e.target.value } })}
                              className="w-14 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)] text-center"
                              min={0}
                              data-testid="input-element-radius"
                            />
                          </div>
                        </>
                      )}
                      {selectedElement.type === "overlay" && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[var(--ide-text-secondary)]">Overlay Color</span>
                          <input
                            type="text"
                            value={selectedElement.style?.backgroundColor || "rgba(0,0,0,0.3)"}
                            onChange={e => updateElement(selectedElement.id, { style: { ...selectedElement.style, backgroundColor: e.target.value } })}
                            className="w-32 bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                            data-testid="input-element-overlay-color"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activePanel === "audio" && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[var(--ide-text-secondary)] uppercase tracking-wider">Audio Tracks</span>
                  <button onClick={addAudioTrack} className="p-1 rounded hover:bg-[var(--ide-hover)] text-[var(--ide-text-secondary)]" title="Add Audio Track" data-testid="button-add-audio-track">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {localAudioTracks.length === 0 && (
                  <div className="text-xs text-[var(--ide-text-secondary)] text-center py-6 opacity-60">
                    No audio tracks. Click + to add background music or sound effects.
                  </div>
                )}

                {localAudioTracks.map((track, idx) => (
                  <div key={track.id} className="bg-[var(--ide-surface)] rounded-lg p-3 space-y-2 border border-[var(--ide-border)]" data-testid={`audio-track-${idx}`}>
                    <div className="flex items-center justify-between">
                      <input
                        value={track.name}
                        onChange={e => updateAudioTrack(track.id, { name: e.target.value })}
                        className="bg-transparent border-none text-xs text-[var(--ide-text)] font-medium flex-1 outline-none"
                        placeholder="Track name"
                        data-testid={`input-audio-name-${idx}`}
                      />
                      <button onClick={() => deleteAudioTrack(track.id)} className="p-0.5 rounded hover:bg-red-500/10 text-[var(--ide-text-secondary)] hover:text-red-400" data-testid={`button-delete-audio-${idx}`}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--ide-text-secondary)]">Audio URL</span>
                      <input
                        value={track.url}
                        onChange={e => updateAudioTrack(track.id, { url: e.target.value })}
                        placeholder="https://example.com/audio.mp3"
                        className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-2 py-1 text-xs text-[var(--ide-text)] mt-0.5"
                        data-testid={`input-audio-url-${idx}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-[var(--ide-text-secondary)]">Start (s)</span>
                        <input
                          type="number"
                          value={track.startTime}
                          onChange={e => updateAudioTrack(track.id, { startTime: Math.max(0, Number(e.target.value)) })}
                          className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                          min={0}
                          step={0.1}
                          data-testid={`input-audio-start-${idx}`}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--ide-text-secondary)]">Duration (s)</span>
                        <input
                          type="number"
                          value={track.duration}
                          onChange={e => updateAudioTrack(track.id, { duration: Math.max(0.1, Number(e.target.value)) })}
                          className="w-full bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded px-1.5 py-0.5 text-xs text-[var(--ide-text)]"
                          min={0.1}
                          step={0.1}
                          data-testid={`input-audio-duration-${idx}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--ide-text-secondary)]">Volume</span>
                      <input
                        type="range"
                        value={track.volume * 100}
                        onChange={e => updateAudioTrack(track.id, { volume: Number(e.target.value) / 100 })}
                        min={0}
                        max={100}
                        className="flex-1 h-1 accent-[#0079F2]"
                        data-testid={`input-audio-volume-${idx}`}
                      />
                      <span className="text-[9px] text-[var(--ide-text-secondary)] w-8 text-right">{Math.round(track.volume * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
