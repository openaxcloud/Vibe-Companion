import React, { useRef } from "react";
import {
  Globe, Smartphone, Presentation, Play, Palette, BarChart3,
  Cog, Gamepad2, PenTool, Table2, ChevronLeft, ChevronRight, X, Check
} from "lucide-react";

export interface ArtifactTypeOption {
  id: string;
  label: string;
  icon: typeof Globe;
  description: string;
}

export const ARTIFACT_TYPE_OPTIONS: ArtifactTypeOption[] = [
  { id: "web", label: "Web", icon: Globe, description: "React/Vite full-stack web application" },
  { id: "mobile", label: "Mobile", icon: Smartphone, description: "Responsive PWA with mobile-first layout" },
  { id: "slides", label: "Slides", icon: Presentation, description: "Reveal.js presentation with speaker notes" },
  { id: "animation", label: "Animation", icon: Play, description: "CSS/JS animation with timeline controls" },
  { id: "design", label: "Design", icon: Palette, description: "Static HTML/CSS visual-first layout" },
  { id: "data-visualization", label: "Data Viz", icon: BarChart3, description: "D3/Chart.js interactive dashboards" },
  { id: "automation", label: "Automation", icon: Cog, description: "Node.js scripts with scheduling" },
  { id: "3d-game", label: "3D Game", icon: Gamepad2, description: "Three.js project with game loop" },
  { id: "document", label: "Document", icon: PenTool, description: "Rich text editor with PDF export" },
  { id: "spreadsheet", label: "Spreadsheet", icon: Table2, description: "Data grid with formulas and CSV support" },
];

interface ArtifactTypeCarouselProps {
  selectedType: string | null;
  onSelectType: (type: string | null) => void;
  size?: "sm" | "md";
  showDescription?: boolean;
}

export default function ArtifactTypeCarousel({
  selectedType,
  onSelectType,
  size = "md",
  showDescription = false,
}: ArtifactTypeCarouselProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scrollCarousel = (dir: "left" | "right") => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  const isSmall = size === "sm";

  return (
    <div className="relative" data-testid="artifact-type-carousel">
      <button
        onClick={() => scrollCarousel("left")}
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F] transition-all shadow-md ${isSmall ? "w-5 h-5 -ml-2" : "w-7 h-7 -ml-3"}`}
        data-testid="button-artifact-carousel-left"
      >
        <ChevronLeft className={isSmall ? "w-3 h-3" : "w-4 h-4"} />
      </button>
      <div
        ref={carouselRef}
        className={`flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth ${isSmall ? "px-4" : "px-6"}`}
      >
        {ARTIFACT_TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = selectedType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelectType(isSelected ? null : opt.id)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap border transition-all shrink-0 ${
                isSmall ? "px-2 py-1 rounded-lg text-[10px]" : "px-3 py-2 rounded-xl text-xs"
              } font-medium ${
                isSelected
                  ? "bg-[#0079F2]/10 border-[#0079F2]/30 text-[#0079F2]"
                  : "bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F]"
              }`}
              data-testid={`button-artifact-type-${opt.id}`}
            >
              {isSelected && (
                <Check className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
              )}
              <Icon className={isSmall ? "w-3 h-3" : "w-3.5 h-3.5"} />
              {opt.label}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => scrollCarousel("right")}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 rounded-full bg-[var(--ide-panel)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:border-[#3B4B5F] transition-all shadow-md ${isSmall ? "w-5 h-5 -mr-2" : "w-7 h-7 -mr-3"}`}
        data-testid="button-artifact-carousel-right"
      >
        <ChevronRight className={isSmall ? "w-3 h-3" : "w-4 h-4"} />
      </button>
    </div>
  );
}

export function ArtifactTypePill({
  type,
  onRemove,
  size = "md",
}: {
  type: string;
  onRemove: () => void;
  size?: "sm" | "md";
}) {
  const opt = ARTIFACT_TYPE_OPTIONS.find((t) => t.id === type);
  if (!opt) return null;
  const Icon = opt.icon;
  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#0079F2]/10 border border-[#0079F2]/20 text-[#0079F2] font-medium ${
        isSmall ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
      data-testid="badge-artifact-type"
    >
      <Icon className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {opt.label}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-white transition-colors"
        data-testid="button-remove-artifact-type"
      >
        <X className={isSmall ? "w-2.5 h-2.5" : "w-3 h-3"} />
      </button>
    </span>
  );
}
