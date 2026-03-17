import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Search, ArrowLeft, ExternalLink, Plus, Shield,
  BarChart, BookOpen, CreditCard, GitBranch, Layout,
  Zap, ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MCP_DIRECTORY_SERVERS } from "@shared/schema";

const iconMap: Record<string, typeof Zap> = {
  clipboard: ClipboardList,
  "bar-chart": BarChart,
  "book-open": BookOpen,
  "git-branch": GitBranch,
  layout: Layout,
  zap: Zap,
  "credit-card": CreditCard,
};

const categoryColors: Record<string, string> = {
  "Project Management": "#F97316",
  "Analytics": "#06B6D4",
  "Productivity": "#10B981",
  "Developer Tools": "#F26522",
  "Payments": "#0CCE6B",
};

export default function McpDirectory() {
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(MCP_DIRECTORY_SERVERS.map(s => s.category))].sort();

  const filtered = MCP_DIRECTORY_SERVERS.filter(s =>
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     s.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (!selectedCategory || s.category === selectedCategory)
  );

  const generateInstallLink = (server: typeof MCP_DIRECTORY_SERVERS[number]) => {
    const payload = btoa(JSON.stringify({
      displayName: server.name,
      baseUrl: server.baseUrl,
    }));
    return `${window.location.origin}/dashboard?mcp=${encodeURIComponent(payload)}`;
  };

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="mcp-directory-page">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={isAuthenticated ? "/dashboard" : "/"}>
            <button className="p-2 rounded-lg hover:bg-[var(--ide-surface)] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Shield className="w-5 h-5 text-[#0079F2]" />
              MCP Server Directory
            </h1>
            <p className="text-sm text-[var(--ide-text-secondary)] mt-0.5">
              Connect your Agent to external tools and data sources via Model Context Protocol
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search MCP servers..."
              className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-10 text-sm text-[var(--ide-text)] rounded-lg pl-10"
              data-testid="input-search-mcp"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6" data-testid="category-filters">
          <button
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              !selectedCategory
                ? "border-[#0079F2] bg-[#0079F2]/15 text-[#0079F2]"
                : "border-[var(--ide-border)] text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            }`}
            onClick={() => setSelectedCategory(null)}
            data-testid="button-filter-all"
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                selectedCategory === cat
                  ? "bg-opacity-15 border-current"
                  : "border-[var(--ide-border)] hover:text-[var(--ide-text)]"
              }`}
              style={{ color: selectedCategory === cat ? (categoryColors[cat] || "#9DA2B0") : undefined }}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              data-testid={`button-filter-${cat.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="mcp-server-grid">
          {filtered.map(server => {
            const Icon = iconMap[server.icon] || Zap;
            const color = categoryColors[server.category] || "#0079F2";
            const installLink = generateInstallLink(server);

            return (
              <div
                key={server.id}
                className="rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/50 p-5 hover:border-[#0079F2]/50 transition-all group"
                data-testid={`card-mcp-server-${server.id}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold" data-testid={`text-server-name-${server.id}`}>{server.name}</h3>
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{ color }}
                    >
                      {server.category}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--ide-text-secondary)] mb-4 leading-relaxed" data-testid={`text-server-desc-${server.id}`}>
                  {server.description}
                </p>
                <div className="flex items-center gap-2">
                  {isAuthenticated ? (
                    <a href={installLink} data-testid={`link-install-${server.id}`}>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-[#0079F2] hover:bg-[#0079F2]/80 text-white gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Replit
                      </Button>
                    </a>
                  ) : (
                    <Link href="/login">
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-[#0079F2] hover:bg-[#0079F2]/80 text-white gap-1.5"
                        data-testid={`link-login-${server.id}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Replit
                      </Button>
                    </Link>
                  )}
                  <a
                    href={server.baseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-bg)] transition-colors"
                    data-testid={`link-external-${server.id}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12" data-testid="text-no-results">
            <p className="text-sm text-[var(--ide-text-muted)]">No MCP servers match your search</p>
          </div>
        )}

        <div className="mt-12 rounded-xl border border-[var(--ide-border)] bg-[var(--ide-surface)]/30 p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Have your own MCP server?</h2>
          <p className="text-sm text-[var(--ide-text-secondary)] mb-4">
            Create an install link so users can add your server to their Replit projects with one click.
          </p>
          <Link href="/mcp-install-link">
            <Button className="bg-[#0079F2] hover:bg-[#0079F2]/80 text-white gap-2" data-testid="link-create-install">
              <ExternalLink className="w-4 h-4" />
              Create Install Link
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
