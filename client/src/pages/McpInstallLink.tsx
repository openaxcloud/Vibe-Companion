import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Check, Link2, Code, ExternalLink, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function McpInstallLink() {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const payload = useMemo(() => {
    return {
      displayName: displayName || "My MCP Server",
      baseUrl: baseUrl || "https://example.com/v1/sse",
    };
  }, [displayName, baseUrl]);

  const encodedPayload = useMemo(() => {
    return btoa(JSON.stringify(payload));
  }, [payload]);

  const installUrl = useMemo(() => {
    return `${window.location.origin}/dashboard?mcp=${encodeURIComponent(encodedPayload)}`;
  }, [encodedPayload]);

  const badgeMarkdown = useMemo(() => {
    return `[![Add MCP Server](https://img.shields.io/badge/Add%20to-E--Code-0079F2?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAydjIwTTIgMTJoMjAiLz48L3N2Zz4=)](${installUrl})`;
  }, [installUrl]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isValid = displayName.trim().length > 0 && baseUrl.trim().length > 0 && baseUrl.startsWith("https://");

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="mcp-install-link-page">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/mcp-directory">
            <button className="p-2 rounded-lg hover:bg-[var(--ide-surface)] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Link2 className="w-5 h-5 text-[#0079F2]" />
              MCP Install Link Generator
            </h1>
            <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
              Create a direct install link for your MCP server
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/50 p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">Server Details</h2>

            <div>
              <label className="text-xs text-[var(--ide-text-secondary)] block mb-1">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="My MCP Server"
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm"
                data-testid="input-display-name"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--ide-text-secondary)] block mb-1">Base URL (HTTPS)</label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-server.com/v1/sse"
                className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-9 text-sm"
                data-testid="input-base-url"
              />
              {baseUrl && !baseUrl.startsWith("https://") && (
                <p className="text-[10px] text-red-400 mt-1">URL must start with https://</p>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Authentication headers are not included in install links for security reasons.
                Users will be prompted to enter any required API keys or auth headers when they add the server.
              </p>
            </div>
          </div>

          {isValid && (
            <>
              <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/50 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">Install Link</h2>
                <div className="relative">
                  <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-3 font-mono text-xs break-all text-[var(--ide-text-secondary)]" data-testid="text-install-url">
                    {installUrl}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={() => copyToClipboard(installUrl, "url")}
                    data-testid="button-copy-url"
                  >
                    {copiedField === "url" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/50 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ide-text-muted)] flex items-center gap-2">
                  <Code className="w-4 h-4" />
                  Badge Markdown
                </h2>
                <div className="relative">
                  <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-3 font-mono text-[10px] break-all text-[var(--ide-text-secondary)] max-h-24 overflow-y-auto" data-testid="text-badge-markdown">
                    {badgeMarkdown}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={() => copyToClipboard(badgeMarkdown, "badge")}
                    data-testid="button-copy-badge"
                  >
                    {copiedField === "badge" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <div className="pt-2" data-testid="badge-preview">
                  <p className="text-[10px] text-[var(--ide-text-muted)] mb-2">Preview:</p>
                  <a href={installUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src="https://img.shields.io/badge/Add%20to-E--Code-0079F2?style=for-the-badge"
                      alt="Add to E-Code"
                      className="h-8"
                    />
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/50 p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ide-text-muted)]">Encoded Payload</h2>
                <div className="relative">
                  <div className="bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-3 font-mono text-[10px] break-all text-[var(--ide-text-secondary)]" data-testid="text-encoded-payload">
                    {encodedPayload}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-7 w-7 p-0"
                    onClick={() => copyToClipboard(encodedPayload, "payload")}
                    data-testid="button-copy-payload"
                  >
                    {copiedField === "payload" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <details className="text-xs">
                  <summary className="text-[var(--ide-text-muted)] cursor-pointer hover:text-[var(--ide-text)]">Decoded JSON</summary>
                  <pre className="mt-2 bg-[var(--ide-bg)] border border-[var(--ide-border)] rounded-lg p-3 text-[10px] text-[var(--ide-text-secondary)] overflow-x-auto" data-testid="text-decoded-json">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
