/**
 * /ssh standalone page — wraps the canonical SSHPanel component.
 * This page is the single source of truth for the full-page SSH view.
 * The IDE side panel and mobile menu both render <SSHPanel> directly;
 * this page adds the page-level chrome (header, container) around it.
 */
import { useAuth } from "@/hooks/use-auth";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import SSHPanel from "@/components/SSHPanel";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TerminalIcon = Terminal as LucideIcon;

export default function SSH() {
  const { user: _user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  // Read projectId from ?projectId=... query param.
  // The /ssh page is an account-level key-management page; when opened in project
  // context the IDE passes ?projectId=<id> so connection-info can return the
  // correct SSH username.  Without it the Connect tab shows a "open from a project"
  // notice rather than sending an invalid username to the backend.
  const projectId = new URLSearchParams(search).get("projectId") ?? undefined;

  return (
    <PageShell>
      <div className="container mx-auto p-6 max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/account")}
            data-testid="button-back-to-account"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Account
          </Button>
        </div>

        <PageHeader
          icon={TerminalIcon}
          title="SSH Access"
          description="Manage SSH keys and connection settings for secure remote access."
        />

        <div className="mt-6 border border-[var(--ide-border)] rounded-lg overflow-hidden bg-[var(--ide-panel)]" style={{ minHeight: 560 }}>
          <SSHPanel
            projectId={projectId}
            onClose={() => navigate("/account")}
          />
        </div>
      </div>
    </PageShell>
  );
}
