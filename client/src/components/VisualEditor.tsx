import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Type, Palette, Move, Image, Code2, Wand2,
  ChevronDown, ChevronRight, Eye, EyeOff, MousePointer2,
  CornerDownRight, Minus, Plus, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const VE_OVERLAY_SCRIPT = `
(function() {
  if (window.__veInitialized) return;
  window.__veInitialized = true;

  var overlay = null;
  var selectedOverlay = null;
  var label = null;
  var selectedEl = null;
  var active = true;

  function createOverlay(id, color) {
    var el = document.createElement("div");
    el.id = id;
    el.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid " + color + ";border-radius:2px;transition:all 0.1s ease;display:none;";
    document.body.appendChild(el);
    return el;
  }

  function createLabel() {
    var el = document.createElement("div");
    el.id = "__ve_label";
    el.style.cssText = "position:fixed;z-index:2147483647;pointer-events:auto;cursor:pointer;background:#0079F2;color:#fff;font-size:10px;font-family:system-ui,sans-serif;font-weight:600;padding:2px 6px;border-radius:3px;white-space:nowrap;display:none;box-shadow:0 1px 4px rgba(0,0,0,0.3);";
    el.title = "Click to jump to source";
    el.addEventListener("click", function(e) {
      e.stopPropagation();
      if (selectedEl) {
        var meta = getElementMeta(selectedEl);
        meta.action = "jump-to-source";
        window.parent.postMessage({ type: "ve:jump", payload: meta }, "*");
      }
    });
    document.body.appendChild(el);
    return el;
  }

  overlay = createOverlay("__ve_hover", "#0079F2");
  selectedOverlay = createOverlay("__ve_selected", "#7C65CB");
  selectedOverlay.style.borderWidth = "2px";
  selectedOverlay.style.boxShadow = "0 0 0 1px rgba(124,101,203,0.3)";
  label = createLabel();

  function getElementMeta(el) {
    var rect = el.getBoundingClientRect();
    var cs = window.getComputedStyle(el);
    var tag = el.tagName.toLowerCase();
    var text = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) text += el.childNodes[i].textContent;
    }
    text = text.trim();
    var imgSrc = "";
    if (tag === "img") imgSrc = el.getAttribute("src") || "";
    else {
      var bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== "none") imgSrc = bgImg;
    }
    return {
      tag: tag,
      text: text,
      className: el.className || "",
      id: el.id || "",
      imgSrc: imgSrc,
      isImg: tag === "img",
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      styles: {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
        paddingTop: cs.paddingTop,
        paddingRight: cs.paddingRight,
        paddingBottom: cs.paddingBottom,
        paddingLeft: cs.paddingLeft,
        margin: cs.margin,
        marginTop: cs.marginTop,
        marginRight: cs.marginRight,
        marginBottom: cs.marginBottom,
        marginLeft: cs.marginLeft,
        borderRadius: cs.borderRadius,
        borderColor: cs.borderColor,
        borderWidth: cs.borderWidth,
        width: cs.width,
        height: cs.height,
        display: cs.display,
        textAlign: cs.textAlign
      },
      dataTestId: el.getAttribute("data-testid") || "",
      xpath: getXPath(el)
    };
  }

  function getXPath(el) {
    if (!el || el.nodeType !== 1) return "";
    var parts = [];
    while (el && el.nodeType === 1) {
      var idx = 1;
      var sib = el.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++;
        sib = sib.previousSibling;
      }
      parts.unshift(el.tagName.toLowerCase() + "[" + idx + "]");
      el = el.parentNode;
    }
    return "/" + parts.join("/");
  }

  function positionOverlay(ov, rect) {
    ov.style.left = rect.x + "px";
    ov.style.top = rect.y + "px";
    ov.style.width = rect.width + "px";
    ov.style.height = rect.height + "px";
    ov.style.display = "block";
  }

  function shouldIgnore(el) {
    if (!el || el === document.body || el === document.documentElement) return true;
    if (el.id && el.id.startsWith("__ve_")) return true;
    return false;
  }

  document.addEventListener("mousemove", function(e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (shouldIgnore(el)) {
      overlay.style.display = "none";
      return;
    }
    var rect = el.getBoundingClientRect();
    positionOverlay(overlay, rect);
    window.parent.postMessage({ type: "ve:hover", payload: getElementMeta(el) }, "*");
  }, true);

  document.addEventListener("click", function(e) {
    if (!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (shouldIgnore(el)) return;
    e.preventDefault();
    e.stopPropagation();
    selectedEl = el;
    var rect = el.getBoundingClientRect();
    positionOverlay(selectedOverlay, rect);
    label.textContent = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ").filter(Boolean).slice(0, 2).join(".") : "");
    label.style.left = rect.x + "px";
    label.style.top = Math.max(0, rect.y - 20) + "px";
    label.style.display = "block";
    window.parent.postMessage({ type: "ve:select", payload: getElementMeta(el) }, "*");
  }, true);

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      selectedEl = null;
      selectedOverlay.style.display = "none";
      label.style.display = "none";
      window.parent.postMessage({ type: "ve:deselect" }, "*");
    }
  }, true);

  window.addEventListener("message", function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === "ve:activate") { active = true; }
    if (e.data.type === "ve:deactivate") {
      active = false;
      overlay.style.display = "none";
      selectedOverlay.style.display = "none";
      label.style.display = "none";
      selectedEl = null;
    }
    if (e.data.type === "ve:update" && selectedEl) {
      var changes = e.data.payload;
      if (changes.text !== undefined) {
        var textNode = null;
        for (var i = 0; i < selectedEl.childNodes.length; i++) {
          if (selectedEl.childNodes[i].nodeType === 3 && selectedEl.childNodes[i].textContent.trim()) {
            textNode = selectedEl.childNodes[i];
            break;
          }
        }
        if (textNode) textNode.textContent = changes.text;
        else selectedEl.textContent = changes.text;
      }
      if (changes.color) selectedEl.style.color = changes.color;
      if (changes.backgroundColor) selectedEl.style.backgroundColor = changes.backgroundColor;
      if (changes.fontSize) selectedEl.style.fontSize = changes.fontSize;
      if (changes.paddingTop) selectedEl.style.paddingTop = changes.paddingTop;
      if (changes.paddingRight) selectedEl.style.paddingRight = changes.paddingRight;
      if (changes.paddingBottom) selectedEl.style.paddingBottom = changes.paddingBottom;
      if (changes.paddingLeft) selectedEl.style.paddingLeft = changes.paddingLeft;
      if (changes.marginTop) selectedEl.style.marginTop = changes.marginTop;
      if (changes.marginRight) selectedEl.style.marginRight = changes.marginRight;
      if (changes.marginBottom) selectedEl.style.marginBottom = changes.marginBottom;
      if (changes.marginLeft) selectedEl.style.marginLeft = changes.marginLeft;
      if (changes.borderRadius) selectedEl.style.borderRadius = changes.borderRadius;
      if (changes.imgSrc && selectedEl.tagName === "IMG") selectedEl.src = changes.imgSrc;
      var rect = selectedEl.getBoundingClientRect();
      positionOverlay(selectedOverlay, rect);
    }
  });
})();
`;

export interface SelectedElement {
  tag: string;
  text: string;
  className: string;
  id: string;
  imgSrc: string;
  isImg: boolean;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  dataTestId: string;
  xpath: string;
}

interface VisualEditorPanelProps {
  element: SelectedElement | null;
  onClose: () => void;
  onApplyEdit: (edit: VisualEdit) => void;
  onJumpToSource: (element: SelectedElement) => void;
  onAIHandoff: (element: SelectedElement, description: string) => void;
  iframeId: string;
}

export interface VisualEdit {
  type: "text" | "style" | "class" | "image";
  property?: string;
  oldValue: string;
  newValue: string;
  element: SelectedElement;
}

function parsePixelValue(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n);
}

function rgbToHex(rgb: string): string {
  if (rgb.startsWith("#")) return rgb;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";
  const [, r, g, b] = match;
  return "#" + [r, g, b].map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
}

function SpacingBox({ label, values, onChange }: {
  label: string;
  values: { top: number; right: number; bottom: number; left: number };
  onChange: (side: string, value: number) => void;
}) {
  const sides = ["top", "right", "bottom", "left"] as const;
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium text-[var(--ide-text-muted)] uppercase tracking-wider">{label}</div>
      <div className="grid grid-cols-4 gap-1">
        {sides.map(side => (
          <div key={side} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] text-[var(--ide-text-muted)] uppercase">{side[0]}</span>
            <input
              type="number"
              className="w-full h-6 text-center text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#0079F2] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={values[side]}
              onChange={e => onChange(side, parseInt(e.target.value) || 0)}
              data-testid={`input-${label.toLowerCase()}-${side}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function VisualEditorPanel({ element, onClose, onApplyEdit, onJumpToSource, onAIHandoff, iframeId }: VisualEditorPanelProps) {
  const [editText, setEditText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [bgColor, setBgColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(16);
  const [borderRadius, setBorderRadius] = useState(0);
  const [padding, setPadding] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [margin, setMargin] = useState({ top: 0, right: 0, bottom: 0, left: 0 });
  const [imgUrl, setImgUrl] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["text", "colors", "spacing", "image"]));
  const [aiDescription, setAiDescription] = useState("");

  useEffect(() => {
    if (!element) return;
    setEditText(element.text);
    setTextColor(rgbToHex(element.styles.color || "#ffffff"));
    setBgColor(rgbToHex(element.styles.backgroundColor || "rgba(0,0,0,0)"));
    setFontSize(parsePixelValue(element.styles.fontSize || "16px"));
    setBorderRadius(parsePixelValue(element.styles.borderRadius || "0px"));
    setPadding({
      top: parsePixelValue(element.styles.paddingTop || "0"),
      right: parsePixelValue(element.styles.paddingRight || "0"),
      bottom: parsePixelValue(element.styles.paddingBottom || "0"),
      left: parsePixelValue(element.styles.paddingLeft || "0"),
    });
    setMargin({
      top: parsePixelValue(element.styles.marginTop || "0"),
      right: parsePixelValue(element.styles.marginRight || "0"),
      bottom: parsePixelValue(element.styles.marginBottom || "0"),
      left: parsePixelValue(element.styles.marginLeft || "0"),
    });
    setImgUrl(element.imgSrc || "");
    setAiDescription("");
  }, [element]);

  const sendUpdate = useCallback((changes: Record<string, string>) => {
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "ve:update", payload: changes }, "*");
    }
  }, [iframeId]);

  const toggleSection = (s: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  if (!element) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[var(--ide-text-muted)] p-6" data-testid="visual-editor-empty">
        <MousePointer2 className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm font-medium text-[var(--ide-text)]">Visual Editor</p>
        <p className="text-xs text-center mt-1 leading-relaxed max-w-[200px]">
          Click on any element in the preview to inspect and edit it
        </p>
      </div>
    );
  }

  const handleTextApply = () => {
    if (editText !== element.text) {
      sendUpdate({ text: editText });
      onApplyEdit({ type: "text", oldValue: element.text, newValue: editText, element });
    }
  };

  const handleColorApply = (prop: string, value: string) => {
    const oldVal = prop === "color" ? rgbToHex(element.styles.color) : rgbToHex(element.styles.backgroundColor);
    sendUpdate({ [prop]: value });
    onApplyEdit({ type: "style", property: prop, oldValue: oldVal, newValue: value, element });
  };

  const handleFontSizeApply = (value: number) => {
    const px = value + "px";
    sendUpdate({ fontSize: px });
    onApplyEdit({ type: "style", property: "fontSize", oldValue: element.styles.fontSize, newValue: px, element });
  };

  const handleBorderRadiusApply = (value: number) => {
    const px = value + "px";
    sendUpdate({ borderRadius: px });
    onApplyEdit({ type: "style", property: "borderRadius", oldValue: element.styles.borderRadius, newValue: px, element });
  };

  const handleSpacingApply = (type: "padding" | "margin", side: string, value: number) => {
    const prop = type + side.charAt(0).toUpperCase() + side.slice(1);
    const px = value + "px";
    sendUpdate({ [prop]: px });
    onApplyEdit({ type: "style", property: prop, oldValue: element.styles[prop] || "0px", newValue: px, element });
  };

  const handleImgApply = () => {
    if (imgUrl !== element.imgSrc) {
      sendUpdate({ imgSrc: imgUrl });
      onApplyEdit({ type: "image", oldValue: element.imgSrc, newValue: imgUrl, element });
    }
  };

  const SectionHeader = ({ id, icon: Icon, title }: { id: string; icon: typeof Type; title: string }) => (
    <button
      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--ide-surface)]/50 transition-colors"
      onClick={() => toggleSection(id)}
      data-testid={`button-section-${id}`}
    >
      {expandedSections.has(id) ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
      <Icon className="w-3.5 h-3.5 text-[#0079F2]" />
      <span className="text-[11px] font-medium text-[var(--ide-text)]">{title}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-[var(--ide-panel)] overflow-hidden" data-testid="visual-editor-panel">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <Eye className="w-3.5 h-3.5 text-[#7C65CB]" />
        <span className="text-[11px] font-semibold text-[var(--ide-text)] flex-1">Visual Editor</span>
        <button
          className="text-[10px] px-2 py-0.5 rounded bg-[#0079F2]/15 text-[#0079F2] hover:bg-[#0079F2]/25 transition-colors font-medium"
          onClick={() => onJumpToSource(element)}
          title="Jump to source code"
          data-testid="button-jump-to-source"
        >
          <Code2 className="w-3 h-3 inline mr-1" />
          Source
        </button>
        <button
          className="w-6 h-6 rounded flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)] transition-colors"
          onClick={onClose}
          data-testid="button-close-visual-editor"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-[var(--ide-border)] bg-[var(--ide-surface)]/30">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#7C65CB]/15 text-[#7C65CB] font-semibold" data-testid="text-selected-tag">
            {"<"}{element.tag}{element.id ? ` #${element.id}` : ""}{">"}
          </span>
          <span className="text-[9px] text-[var(--ide-text-muted)] truncate flex-1" data-testid="text-selected-class">
            {typeof element.className === "string" ? element.className.split(" ").slice(0, 3).join(" ") : ""}
          </span>
        </div>
        <div className="text-[9px] text-[var(--ide-text-muted)] mt-1 flex gap-3">
          <span>{Math.round(element.rect.width)}×{Math.round(element.rect.height)}</span>
          <span>{element.styles.display}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {element.text && (
          <>
            <SectionHeader id="text" icon={Type} title="Text Content" />
            {expandedSections.has("text") && (
              <div className="px-3 pb-3 space-y-2">
                <textarea
                  className="w-full h-16 text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-2 text-[var(--ide-text)] outline-none resize-none focus:border-[#0079F2] transition-colors"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={handleTextApply}
                  data-testid="input-edit-text"
                />
              </div>
            )}
          </>
        )}

        <SectionHeader id="colors" icon={Palette} title="Colors" />
        {expandedSections.has("colors") && (
          <div className="px-3 pb-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ide-text-secondary)] w-16">Text</span>
              <input
                type="color"
                className="w-6 h-6 rounded border border-[var(--ide-border)] cursor-pointer"
                value={textColor}
                onChange={e => { setTextColor(e.target.value); handleColorApply("color", e.target.value); }}
                data-testid="input-text-color"
              />
              <input
                type="text"
                className="flex-1 h-6 text-[10px] font-mono bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] outline-none focus:border-[#0079F2]"
                value={textColor}
                onChange={e => setTextColor(e.target.value)}
                onBlur={() => handleColorApply("color", textColor)}
                data-testid="input-text-color-hex"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ide-text-secondary)] w-16">Background</span>
              <input
                type="color"
                className="w-6 h-6 rounded border border-[var(--ide-border)] cursor-pointer"
                value={bgColor}
                onChange={e => { setBgColor(e.target.value); handleColorApply("backgroundColor", e.target.value); }}
                data-testid="input-bg-color"
              />
              <input
                type="text"
                className="flex-1 h-6 text-[10px] font-mono bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] outline-none focus:border-[#0079F2]"
                value={bgColor}
                onChange={e => setBgColor(e.target.value)}
                onBlur={() => handleColorApply("backgroundColor", bgColor)}
                data-testid="input-bg-color-hex"
              />
            </div>
          </div>
        )}

        <SectionHeader id="typography" icon={Type} title="Typography" />
        {expandedSections.has("typography") && (
          <div className="px-3 pb-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ide-text-secondary)] w-16">Size</span>
              <button
                className="w-6 h-6 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)]"
                onClick={() => { const v = fontSize - 1; setFontSize(v); handleFontSizeApply(v); }}
                data-testid="button-font-size-decrease"
              ><Minus className="w-3 h-3" /></button>
              <input
                type="number"
                className="w-12 h-6 text-center text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[var(--ide-text)] outline-none focus:border-[#0079F2] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={fontSize}
                onChange={e => { const v = parseInt(e.target.value) || 16; setFontSize(v); }}
                onBlur={() => handleFontSizeApply(fontSize)}
                data-testid="input-font-size"
              />
              <button
                className="w-6 h-6 rounded bg-[var(--ide-surface)] border border-[var(--ide-border)] flex items-center justify-center text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-hover)]"
                onClick={() => { const v = fontSize + 1; setFontSize(v); handleFontSizeApply(v); }}
                data-testid="button-font-size-increase"
              ><Plus className="w-3 h-3" /></button>
              <span className="text-[9px] text-[var(--ide-text-muted)]">px</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--ide-text-secondary)] w-16">Radius</span>
              <input
                type="range"
                className="flex-1 h-1 accent-[#0079F2]"
                min={0}
                max={50}
                value={borderRadius}
                onChange={e => { const v = parseInt(e.target.value); setBorderRadius(v); handleBorderRadiusApply(v); }}
                data-testid="input-border-radius"
              />
              <span className="text-[10px] text-[var(--ide-text-secondary)] w-8 text-right">{borderRadius}px</span>
            </div>
          </div>
        )}

        <SectionHeader id="spacing" icon={Move} title="Spacing" />
        {expandedSections.has("spacing") && (
          <div className="px-3 pb-3 space-y-3">
            <SpacingBox
              label="Padding"
              values={padding}
              onChange={(side, val) => {
                setPadding(p => ({ ...p, [side]: val }));
                handleSpacingApply("padding", side, val);
              }}
            />
            <SpacingBox
              label="Margin"
              values={margin}
              onChange={(side, val) => {
                setMargin(m => ({ ...m, [side]: val }));
                handleSpacingApply("margin", side, val);
              }}
            />
          </div>
        )}

        {(element.isImg || element.imgSrc) && (
          <>
            <SectionHeader id="image" icon={Image} title="Image" />
            {expandedSections.has("image") && (
              <div className="px-3 pb-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
                  <input
                    type="text"
                    className="flex-1 h-6 text-[10px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded px-2 text-[var(--ide-text)] outline-none focus:border-[#0079F2] font-mono"
                    value={imgUrl}
                    onChange={e => setImgUrl(e.target.value)}
                    onBlur={handleImgApply}
                    placeholder="Image URL"
                    data-testid="input-image-url"
                  />
                </div>
                {imgUrl && (
                  <div className="w-full h-20 rounded border border-[var(--ide-border)] overflow-hidden bg-[var(--ide-surface)]">
                    <img src={imgUrl} className="w-full h-full object-contain" alt="Preview" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="border-t border-[var(--ide-border)] mt-1">
          <SectionHeader id="ai" icon={Wand2} title="AI Edit (Complex Changes)" />
          {expandedSections.has("ai") && (
            <div className="px-3 pb-3 space-y-2">
              <textarea
                className="w-full h-14 text-[11px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg p-2 text-[var(--ide-text)] outline-none resize-none focus:border-[#7C65CB] transition-colors placeholder:text-[var(--ide-text-muted)]"
                placeholder="Describe the change you want (e.g., 'Make this a dropdown menu' or 'Add a hover animation')"
                value={aiDescription}
                onChange={e => setAiDescription(e.target.value)}
                data-testid="input-ai-edit-description"
              />
              <Button
                size="sm"
                className="w-full h-7 text-[11px] bg-[#7C65CB] hover:bg-[#6B56B8] text-white rounded-lg gap-1.5"
                onClick={() => { if (aiDescription.trim()) onAIHandoff(element, aiDescription); setAiDescription(""); }}
                disabled={!aiDescription.trim()}
                data-testid="button-send-to-ai"
              >
                <Wand2 className="w-3 h-3" />
                Send to Agent
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function injectVisualEditorScript(iframeId: string) {
  const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (!iframe?.contentWindow) return;
  try {
    const doc = iframe.contentDocument;
    if (doc) {
      const script = doc.createElement("script");
      script.textContent = VE_OVERLAY_SCRIPT;
      doc.body.appendChild(script);
    }
  } catch {
    console.warn("[VisualEditor] Cannot inject into cross-origin iframe:", iframeId);
  }
}

export function activateVisualEditor(iframeId: string) {
  const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({ type: "ve:activate" }, "*");
  }
}

export function deactivateVisualEditor(iframeId: string) {
  const iframe = document.getElementById(iframeId) as HTMLIFrameElement;
  if (iframe?.contentWindow) {
    iframe.contentWindow.postMessage({ type: "ve:deactivate" }, "*");
  }
}
