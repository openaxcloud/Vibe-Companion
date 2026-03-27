import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Terminal, X, Plus, Trash2, Key, Copy, Check, ChevronDown, ChevronRight,
  Loader2, ExternalLink, Monitor,
} from "lucide-react";

interface SshKey {
  id: string;
  label: string;
  fingerprint: string;
  createdAt: string;
}

interface SSHPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function SSHPanel({ projectId, onClose }: SSHPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"keys" | "connect">("keys");
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const sshPort = 2222;
  const sshUser = projectId;
  const sshCommand = `ssh -i ~/.ssh/id_ed25519 -p ${sshPort} ${sshUser}@${hostname}`;
  const sshConfig = `Host ${hostname}-${projectId.slice(0, 8)}
  HostName ${hostname}
  Port ${sshPort}
  User ${sshUser}
  IdentityFile ~/.ssh/id_ed25519`;

  const keysQuery = useQuery<SshKey[]>({
    queryKey: ["/api/ssh-keys"],
    queryFn: async () => {
      const res = await fetch("/api/ssh-keys", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: async ({ label, publicKey }: { label: string; publicKey: string }) => {
      const res = await apiRequest("POST", "/api/ssh-keys", { label, publicKey });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssh-keys"] });
      setShowAddForm(false);
      setLabel("");
      setPublicKey("");
      toast({ title: "SSH key added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add key", description: err.message, variant: "destructive" });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ssh-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssh-keys"] });
      toast({ title: "SSH key deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete key", description: err.message, variant: "destructive" });
    },
  });

  const keys = keysQuery.data || [];

  const copyToClipboard = (text: string, type: "cmd" | "config") => {
    navigator.clipboard.writeText(text);
    if (type === "cmd") {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } else {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="ssh-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#F5A623]" />
          <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest">SSH</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
          onClick={onClose}
          data-testid="button-close-ssh"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex border-b border-[var(--ide-border)] shrink-0">
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${
            activeTab === "keys"
              ? "text-[var(--ide-text)] border-b-2 border-[#F5A623]"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
          }`}
          onClick={() => setActiveTab("keys")}
          data-testid="tab-ssh-keys"
        >
          <Key className="w-3 h-3 inline mr-1" />
          Keys
        </button>
        <button
          className={`flex-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${
            activeTab === "connect"
              ? "text-[var(--ide-text)] border-b-2 border-[#F5A623]"
              : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
          }`}
          onClick={() => setActiveTab("connect")}
          data-testid="tab-ssh-connect"
        >
          <Terminal className="w-3 h-3 inline mr-1" />
          Connect
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "keys" && (
          <div>
            <div className="px-3 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest">
                SSH Keys ({keys.length})
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
                onClick={() => setShowAddForm(!showAddForm)}
                data-testid="button-add-ssh-key"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {showAddForm && (
              <div className="px-3 pb-3" data-testid="ssh-key-add-form">
                <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2.5 space-y-2">
                  <div>
                    <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Label</label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="My laptop key"
                      className="bg-[var(--ide-surface)] border-[var(--ide-border)] h-7 text-[10px] text-[var(--ide-text)] rounded"
                      data-testid="input-ssh-label"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[var(--ide-text-muted)] font-mono block mb-0.5">Public Key</label>
                    <textarea
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder="ssh-ed25519 AAAA... user@host"
                      className="w-full bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded text-[10px] text-[var(--ide-text)] font-mono p-2 h-20 resize-none focus:outline-none focus:ring-1 focus:ring-[#F5A623]/50"
                      data-testid="input-ssh-public-key"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      className="flex-1 h-7 text-[10px] bg-[#F5A623] hover:bg-[#F5A623]/80 text-black rounded font-medium gap-1"
                      onClick={() => addKeyMutation.mutate({ label, publicKey })}
                      disabled={addKeyMutation.isPending || !label.trim() || !publicKey.trim()}
                      data-testid="button-submit-ssh-key"
                    >
                      {addKeyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add Key
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-7 px-2 text-[10px] text-[var(--ide-text-muted)]"
                      onClick={() => { setShowAddForm(false); setLabel(""); setPublicKey(""); }}
                      data-testid="button-cancel-ssh-key"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {keysQuery.isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--ide-text-muted)]" />
              </div>
            )}

            {!keysQuery.isLoading && keys.length === 0 && (
              <div className="px-3 py-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mx-auto mb-3">
                  <Key className="w-6 h-6 text-[var(--ide-text-muted)] opacity-40" />
                </div>
                <p className="text-[11px] text-[var(--ide-text-secondary)] font-medium">No SSH keys</p>
                <p className="text-[10px] text-[var(--ide-text-muted)] mt-1">Add a public key to connect via SSH</p>
              </div>
            )}

            {keys.length > 0 && (
              <div className="space-y-0.5 pb-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="px-3 py-2 hover:bg-[var(--ide-surface)]/30 transition-colors group"
                    data-testid={`ssh-key-${key.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#F5A623]/10 flex items-center justify-center shrink-0">
                        <Key className="w-3.5 h-3.5 text-[#F5A623]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--ide-text)] font-medium truncate">{key.label}</p>
                        <p className="text-[9px] text-[var(--ide-text-muted)] font-mono truncate" data-testid={`ssh-key-fingerprint-${key.id}`}>
                          {key.fingerprint}
                        </p>
                        <p className="text-[8px] text-[var(--ide-text-muted)] mt-0.5">
                          Added {new Date(key.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        className="p-1 text-[var(--ide-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => deleteKeyMutation.mutate(key.id)}
                        data-testid={`button-delete-ssh-key-${key.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "connect" && (
          <div className="px-3 py-3 space-y-4">
            <div>
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest block mb-2">
                Quick Launch
              </span>
              <div className="space-y-1.5">
                <Button
                  className="w-full h-8 text-[11px] bg-[#0079F2] hover:bg-[#0079F2]/80 text-white rounded-md font-medium gap-2 justify-start"
                  onClick={() => {
                    window.open(`vscode://vscode-remote/ssh-remote+${sshUser}@${hostname}:${sshPort}/home/runner`, "_blank");
                  }}
                  data-testid="button-launch-vscode"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Launch VS Code
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </Button>
                <Button
                  className="w-full h-8 text-[11px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded-md font-medium gap-2 justify-start"
                  onClick={() => {
                    window.open(`cursor://vscode-remote/ssh-remote+${sshUser}@${hostname}:${sshPort}/home/runner`, "_blank");
                  }}
                  data-testid="button-launch-cursor"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Launch Cursor
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </Button>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[var(--ide-text-muted)] uppercase tracking-widest block mb-2">
                Connect Manually
              </span>
              <div className="rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2">
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-[10px] font-mono text-[var(--ide-text)] break-all" data-testid="text-ssh-command">
                    {sshCommand}
                  </code>
                  <button
                    className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
                    onClick={() => copyToClipboard(sshCommand, "cmd")}
                    data-testid="button-copy-ssh-command"
                  >
                    {copiedCmd ? <Check className="w-3 h-3 text-[#0CCE6B]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                className="flex items-center gap-1 text-[10px] font-semibold text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
                onClick={() => setShowConfig(!showConfig)}
                data-testid="button-toggle-ssh-config"
              >
                {showConfig ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                SSH Config
              </button>
              {showConfig && (
                <div className="mt-2 rounded-md bg-[var(--ide-bg)] border border-[var(--ide-border)] p-2">
                  <div className="flex items-start justify-between gap-1.5">
                    <pre className="text-[9px] font-mono text-[var(--ide-text-muted)] whitespace-pre overflow-x-auto flex-1" data-testid="text-ssh-config">
                      {sshConfig}
                    </pre>
                    <button
                      className="p-1 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0"
                      onClick={() => copyToClipboard(sshConfig, "config")}
                      data-testid="button-copy-ssh-config"
                    >
                      {copiedConfig ? <Check className="w-3 h-3 text-[#0CCE6B]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-[var(--ide-text-muted)] mt-2 opacity-60">
                    Add this to your ~/.ssh/config file
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-md bg-[#F5A623]/5 border border-[#F5A623]/20 p-2.5">
              <p className="text-[10px] text-[#F5A623] font-medium mb-1">Setup Instructions</p>
              <ol className="text-[9px] text-[var(--ide-text-muted)] space-y-1 list-decimal list-inside">
                <li>Generate a key pair: <code className="text-[8px] bg-[var(--ide-bg)] px-1 py-0.5 rounded">ssh-keygen -t ed25519</code></li>
                <li>Add your public key in the Keys tab above</li>
                <li>Connect using the command above or launch your editor</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
