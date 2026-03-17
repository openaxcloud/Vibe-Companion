import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Link2, Copy, Check, ArrowLeft, Eye, Palette, Wrench,
  AlertTriangle, ExternalLink, Sparkles, Info
} from "lucide-react";
import LZString from "lz-string";

function ECodeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path d="M7 5.5C7 4.67 7.67 4 8.5 4H15.5C16.33 4 17 4.67 17 5.5V12H8.5C7.67 12 7 11.33 7 10.5V5.5Z" fill="#F26522"/>
      <path d="M17 12H25.5C26.33 12 27 12.67 27 13.5V18.5C27 19.33 26.33 20 25.5 20H17V12Z" fill="#F26522"/>
      <path d="M7 21.5C7 20.67 7.67 20 8.5 20H17V28H8.5C7.67 28 7 27.33 7 26.5V21.5Z" fill="#F26522"/>
    </svg>
  );
}

const MAX_URL_LENGTH = 8000;

function BadgeSVG({ caption = "Open in E-Code" }: { caption?: string }) {
  const width = Math.max(160, caption.length * 8 + 80);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={32}
      viewBox={`0 0 ${width} 32`}
      fill="none"
    >
      <rect width={width} height="32" rx="6" fill="#0E1525" />
      <rect x="0.5" y="0.5" width={width - 1} height="31" rx="5.5" stroke="#2B3245" />
      <g transform="translate(10, 6)">
        <path d="M3.5 2.75C3.5 2.335 3.835 2 4.25 2H7.75C8.165 2 8.5 2.335 8.5 2.75V6H4.25C3.835 6 3.5 5.665 3.5 5.25V2.75Z" fill="#F26522"/>
        <path d="M8.5 6H12.75C13.165 6 13.5 6.335 13.5 6.75V9.25C13.5 9.665 13.165 10 12.75 10H8.5V6Z" fill="#F26522"/>
        <path d="M3.5 10.75C3.5 10.335 3.835 10 4.25 10H8.5V14H4.25C3.835 14 3.5 13.665 3.5 13.25V10.75Z" fill="#F26522"/>
      </g>
      <text x="34" y="20.5" fill="white" fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="500">
        {caption}
      </text>
    </svg>
  );
}

export default function OpenInReplit() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [stackMode, setStackMode] = useState<"design" | "build">("build");
  const [referrer, setReferrer] = useState("");
  const [badgeCaption, setBadgeCaption] = useState("Open in E-Code");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const compressedPrompt = useMemo(() => {
    if (!prompt.trim()) return "";
    try {
      return LZString.compressToEncodedURIComponent(prompt.trim());
    } catch {
      return "";
    }
  }, [prompt]);

  const generatedUrl = useMemo(() => {
    if (!compressedPrompt) return "";
    const base = window.location.origin;
    const params = new URLSearchParams();
    params.set("prompt", compressedPrompt);
    params.set("stack", stackMode);
    if (referrer.trim()) params.set("referrer", referrer.trim());
    return `${base}/?${params.toString()}`;
  }, [compressedPrompt, stackMode, referrer]);

  const urlTooLong = generatedUrl.length > MAX_URL_LENGTH;

  const badgeMarkdown = useMemo(() => {
    if (!generatedUrl) return "";
    const badgeUrl = `${window.location.origin}/badge/${encodeURIComponent(badgeCaption || "Open in E-Code")}`;
    return `[![${badgeCaption}](${badgeUrl})](${generatedUrl})`;
  }, [generatedUrl, badgeCaption]);

  const badgeHtml = useMemo(() => {
    if (!generatedUrl) return "";
    const badgeUrl = `${window.location.origin}/badge/${encodeURIComponent(badgeCaption || "Open in E-Code")}`;
    return `<a href="${generatedUrl}"><img src="${badgeUrl}" alt="${badgeCaption}" /></a>`;
  }, [generatedUrl, badgeCaption]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({ title: "Copied!", description: `${field} copied to clipboard.` });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="open-in-replit-page">
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-[var(--ide-border)]/50 bg-[var(--ide-bg)]">
        <div className="flex items-center gap-3">
          <Link href={isAuthenticated ? "/dashboard" : "/"}>
            <button className="flex items-center gap-2 text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              <ECodeLogo size={24} />
              <span className="text-lg font-bold tracking-tight text-[var(--ide-text)]">E-Code</span>
            </button>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button variant="ghost" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]" data-testid="nav-dashboard">
                Dashboard
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)]" data-testid="nav-login">
                  Log in
                </Button>
              </Link>
              <Link href="/login?signup=true">
                <Button className="h-9 px-5 text-sm font-semibold bg-[#0079F2] hover:bg-[#0066CC] text-white rounded-lg" data-testid="nav-signup">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#0079F2]/10 border border-[#0079F2]/20 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#0079F2]" />
            </div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">"Open in E-Code" Link Builder</h1>
          </div>
          <p className="text-[var(--ide-text-secondary)] text-sm leading-relaxed max-w-xl" data-testid="text-page-description">
            Create shareable links and badges that open E-Code with a pre-filled prompt. Great for READMEs, tutorials, and documentation.
          </p>
        </div>

        <div className="space-y-8">
          <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] p-6">
            <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7C65CB]" />
              Configure Your Link
            </h2>

            <div className="space-y-5">
              <div>
                <Label htmlFor="prompt-input" className="text-sm font-medium mb-2 block">
                  Prompt <span className="text-[var(--ide-text-muted)]">(required)</span>
                </Label>
                <textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Build a portfolio website with a dark theme and project showcase..."
                  rows={4}
                  className="w-full rounded-lg border border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] px-4 py-3 text-sm leading-relaxed resize-y outline-none focus:border-[#0079F2]/50 focus:ring-1 focus:ring-[#0079F2]/20 transition-all"
                  data-testid="input-link-prompt"
                />
                {prompt.trim() && (
                  <p className="mt-1.5 text-[11px] text-[var(--ide-text-muted)]" data-testid="text-compressed-size">
                    Compressed: {compressedPrompt.length} chars (original: {prompt.trim().length} chars)
                  </p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">Stack Mode</Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStackMode("design")}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      stackMode === "design"
                        ? "border-[#7C65CB]/50 bg-[#7C65CB]/10 text-[var(--ide-text)]"
                        : "border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:border-[#3B4B5F]"
                    }`}
                    data-testid="button-stack-design"
                  >
                    <Palette className={`w-5 h-5 ${stackMode === "design" ? "text-[#7C65CB]" : ""}`} />
                    <div className="text-left">
                      <div className="text-sm font-medium">Design</div>
                      <div className="text-[11px] text-[var(--ide-text-muted)]">UI/UX focused mode</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setStackMode("build")}
                    className={`flex-1 flex items-center gap-3 p-4 rounded-xl border transition-all ${
                      stackMode === "build"
                        ? "border-[#0079F2]/50 bg-[#0079F2]/10 text-[var(--ide-text)]"
                        : "border-[var(--ide-border)] bg-[var(--ide-bg)] text-[var(--ide-text-secondary)] hover:border-[#3B4B5F]"
                    }`}
                    data-testid="button-stack-build"
                  >
                    <Wrench className={`w-5 h-5 ${stackMode === "build" ? "text-[#0079F2]" : ""}`} />
                    <div className="text-left">
                      <div className="text-sm font-medium">Build</div>
                      <div className="text-[11px] text-[var(--ide-text-muted)]">Full agent mode</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="referrer-input" className="text-sm font-medium mb-2 block">
                  Referrer <span className="text-[var(--ide-text-muted)]">(optional)</span>
                </Label>
                <Input
                  id="referrer-input"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  placeholder="e.g., my-tutorial, github-readme"
                  className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-sm"
                  data-testid="input-referrer"
                />
                <p className="mt-1.5 text-[11px] text-[var(--ide-text-muted)]">
                  Track where clicks come from. This value is passed as a URL parameter.
                </p>
              </div>
            </div>
          </div>

          {generatedUrl && (
            <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-[#0CCE6B]" />
                Generated Link
              </h2>

              {urlTooLong && (
                <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs" data-testid="warning-url-length">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>URL is too long</strong> ({generatedUrl.length.toLocaleString()} chars). Some browsers and services may truncate URLs over {MAX_URL_LENGTH.toLocaleString()} characters. Consider shortening your prompt.
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium text-[var(--ide-text-muted)] mb-1.5 block">URL</Label>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] font-mono text-xs break-all text-[var(--ide-text-secondary)] max-h-24 overflow-y-auto" data-testid="text-generated-url">
                      {generatedUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 h-auto border-[var(--ide-border)]"
                      onClick={() => copyToClipboard(generatedUrl, "URL")}
                      data-testid="button-copy-url"
                    >
                      {copiedField === "URL" ? <Check className="w-4 h-4 text-[#0CCE6B]" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium text-[var(--ide-text-muted)] mb-1.5 block">Test Link</Label>
                  <a
                    href={generatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#0079F2] hover:text-[#0079F2]/80 transition-colors"
                    data-testid="link-test-url"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open generated link in new tab
                  </a>
                </div>
              </div>
            </div>
          )}

          {generatedUrl && (
            <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] p-6">
              <h2 className="text-lg font-semibold mb-5 flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#F26522]" />
                Badge
              </h2>

              <div className="space-y-5">
                <div>
                  <Label htmlFor="badge-caption-input" className="text-xs font-medium text-[var(--ide-text-muted)] mb-1.5 block">
                    Badge Caption
                  </Label>
                  <Input
                    id="badge-caption-input"
                    value={badgeCaption}
                    onChange={(e) => setBadgeCaption(e.target.value)}
                    placeholder="Open in E-Code"
                    className="bg-[var(--ide-bg)] border-[var(--ide-border)] text-sm max-w-xs"
                    data-testid="input-badge-caption"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium text-[var(--ide-text-muted)] mb-2 block">Preview</Label>
                  <div className="inline-block p-4 rounded-lg bg-white/5 border border-[var(--ide-border)]" data-testid="badge-preview">
                    <BadgeSVG caption={badgeCaption || "Open in E-Code"} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-[var(--ide-text-muted)]">Markdown</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={() => copyToClipboard(badgeMarkdown, "Markdown")}
                      data-testid="button-copy-markdown"
                    >
                      {copiedField === "Markdown" ? <Check className="w-3 h-3 text-[#0CCE6B]" /> : <Copy className="w-3 h-3" />}
                      {copiedField === "Markdown" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] font-mono text-xs break-all text-[var(--ide-text-secondary)] max-h-20 overflow-y-auto" data-testid="text-badge-markdown">
                    {badgeMarkdown}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs font-medium text-[var(--ide-text-muted)]">HTML</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={() => copyToClipboard(badgeHtml, "HTML")}
                      data-testid="button-copy-html"
                    >
                      {copiedField === "HTML" ? <Check className="w-3 h-3 text-[#0CCE6B]" /> : <Copy className="w-3 h-3" />}
                      {copiedField === "HTML" ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--ide-bg)] border border-[var(--ide-border)] font-mono text-xs break-all text-[var(--ide-text-secondary)] max-h-20 overflow-y-auto" data-testid="text-badge-html">
                    {badgeHtml}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-panel)] p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-[var(--ide-text-muted)]" />
              How It Works
            </h2>
            <div className="space-y-3 text-sm text-[var(--ide-text-secondary)] leading-relaxed">
              <p>
                The link builder compresses your prompt using <strong className="text-[var(--ide-text)]">LZ-string</strong> to keep URLs short and shareable.
                When someone clicks the link, the prompt is decompressed and auto-filled into the project creation form.
              </p>
              <p>
                The <strong className="text-[var(--ide-text)]">stack</strong> parameter determines which mode opens: <em>Design</em> for UI/UX-focused projects
                or <em>Build</em> for full agent mode.
              </p>
              <p>
                The optional <strong className="text-[var(--ide-text)]">referrer</strong> parameter helps you track which links drive the most traffic.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
