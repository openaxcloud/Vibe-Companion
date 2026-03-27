import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Eye, EyeOff, Loader2, Key, Lock, X, Check, Pencil,
  Link2, Unlink, FileJson, FileText, ChevronDown, ChevronRight,
} from "lucide-react";

interface EnvVar {
  id: string;
  projectId: string;
  key: string;
  encryptedValue: string;
  createdAt: string;
}

interface AccountEnvVar {
  id: string;
  userId: string;
  key: string;
  encryptedValue: string;
  createdAt: string;
}

interface LinkedAccountVar {
  id: string;
  accountEnvVarId: string;
  projectId: string;
  key: string;
  encryptedValue: string;
  createdAt: string;
}

type TabType = "app" | "account";
type BulkEditMode = "json" | "env" | null;

function LanguageAccessHelp() {
  const [expanded, setExpanded] = useState(false);

  const languages = [
    { name: "JavaScript / TypeScript", code: "process.env.KEY" },
    { name: "Python", code: "os.environ['KEY']" },
    { name: "Go", code: "os.Getenv(\"KEY\")" },
    { name: "Ruby", code: "ENV['KEY']" },
    { name: "Java", code: "System.getenv(\"KEY\")" },
    { name: "C#", code: "Environment.GetEnvironmentVariable(\"KEY\")" },
  ];

  return (
    <div className="px-3 py-2 border-b border-[#2B3245]">
      <div className="flex items-center gap-1.5 mb-1">
        <Lock className="w-3 h-3 text-[#676D7E]" />
        <span className="text-[10px] text-[#676D7E]">Values are encrypted at rest (AES-256-GCM)</span>
      </div>
      <button
        className="flex items-center gap-1 text-[9px] text-[#4A5068] hover:text-[#9DA2B0] transition-colors"
        onClick={() => setExpanded(!expanded)}
        data-testid="button-toggle-language-help"
      >
        {expanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
        Access in your code
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          {languages.map((lang) => (
            <div key={lang.name} className="flex items-center gap-2">
              <span className="text-[9px] text-[#4A5068] w-24 shrink-0">{lang.name}</span>
              <code className="text-[9px] text-[#9DA2B0] bg-[#0E1525] px-1.5 py-0.5 rounded font-mono">{lang.code}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BulkEditor({ projectId, envVars, mode, onClose }: {
  projectId: string;
  envVars: EnvVar[];
  mode: "json" | "env";
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialContent = mode === "json"
    ? JSON.stringify(
        Object.fromEntries(envVars.map(ev => [ev.key, ev.encryptedValue])),
        null,
        2
      )
    : envVars.map(ev => `${ev.key}=${ev.encryptedValue}`).join("\n");

  const [content, setContent] = useState(initialContent);

  const bulkMutation = useMutation({
    mutationFn: async (vars: Record<string, string>) => {
      await apiRequest("PUT", `/api/projects/${projectId}/env-vars/bulk`, { vars });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "env-vars"] });
      toast({ title: "Secrets updated from bulk edit" });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    try {
      let vars: Record<string, string>;
      if (mode === "json") {
        vars = JSON.parse(content);
        if (typeof vars !== "object" || Array.isArray(vars)) {
          throw new Error("Must be a JSON object");
        }
        for (const [k, v] of Object.entries(vars)) {
          if (typeof v !== "string") throw new Error(`Value for "${k}" must be a string`);
        }
      } else {
        vars = {};
        const lines = content.split("\n").filter(l => l.trim() && !l.trim().startsWith("#"));
        for (const line of lines) {
          const eqIdx = line.indexOf("=");
          if (eqIdx === -1) throw new Error(`Invalid line: "${line}"`);
          const key = line.slice(0, eqIdx).trim();
          let value = line.slice(eqIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!key) throw new Error("Empty key found");
          vars[key] = value;
        }
      }
      bulkMutation.mutate(vars);
    } catch (err: any) {
      toast({ title: "Parse error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="bulk-editor">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
        <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">
          Edit as {mode === "json" ? "JSON" : ".env"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]"
          onClick={onClose}
          data-testid="button-close-bulk-editor"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex-1 p-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full bg-[#0E1525] border border-[#2B3245] rounded p-2 text-[11px] text-[#F5F9FC] font-mono resize-none focus:border-[#0079F2] focus:outline-none"
          spellCheck={false}
          data-testid="textarea-bulk-editor"
        />
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-[#2B3245]">
        <Button
          className="flex-1 h-7 text-[10px] bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded font-medium gap-1"
          onClick={handleSave}
          disabled={bulkMutation.isPending}
          data-testid="button-save-bulk"
        >
          {bulkMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save All
        </Button>
        <Button
          variant="ghost"
          className="h-7 px-3 text-[10px] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
          onClick={onClose}
          data-testid="button-cancel-bulk"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function AppSecretsTab({ projectId, externalAddMode, onAddModeChange }: { projectId: string; externalAddMode: boolean; onAddModeChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const addMode = externalAddMode;
  const setAddMode = onAddModeChange;
  const [bulkMode, setBulkMode] = useState<BulkEditMode>(null);

  const envVarsQuery = useQuery<EnvVar[]>({
    queryKey: ["/api/projects", projectId, "env-vars"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/env-vars`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load env vars");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("POST", `/api/projects/${projectId}/env-vars`, { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "env-vars"] });
      setNewKey("");
      setNewValue("");
      setAddMode(false);
      toast({ title: "Environment variable added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add variable", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      await apiRequest("PATCH", `/api/projects/${projectId}/env-vars/${id}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "env-vars"] });
      setEditingId(null);
      setEditValue("");
      toast({ title: "Environment variable updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update variable", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/env-vars/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "env-vars"] });
      toast({ title: "Environment variable deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete variable", description: err.message, variant: "destructive" });
    },
  });

  const toggleShowValue = (id: string) => {
    setShowValues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const envVars = envVarsQuery.data || [];

  if (bulkMode) {
    return <BulkEditor projectId={projectId} envVars={envVars} mode={bulkMode} onClose={() => setBulkMode(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <LanguageAccessHelp />

        {addMode && (
          <div className="px-3 py-2.5 border-b border-[#2B3245] bg-[#0E1525]/50" data-testid="env-var-add-form">
            <div className="space-y-2">
              <Input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="KEY_NAME"
                className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
                autoFocus
                data-testid="input-env-key"
              />
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                type="password"
                className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
                data-testid="input-env-value"
              />
              <div className="flex items-center gap-1.5">
                <Button
                  className="flex-1 h-7 text-[10px] bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded font-medium gap-1"
                  onClick={() => {
                    if (newKey.trim() && newValue.trim()) {
                      createMutation.mutate({ key: newKey.trim(), value: newValue });
                    }
                  }}
                  disabled={!newKey.trim() || !newValue.trim() || createMutation.isPending}
                  data-testid="button-save-env-var"
                >
                  {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Add Secret
                </Button>
                <Button
                  variant="ghost"
                  className="h-7 px-2 text-[10px] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
                  onClick={() => { setAddMode(false); setNewKey(""); setNewValue(""); }}
                  data-testid="button-cancel-env-var"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {envVarsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-[#676D7E]" />
          </div>
        ) : envVars.length === 0 && !addMode ? (
          <div className="px-3 py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center mx-auto mb-2">
              <Key className="w-5 h-5 text-[#676D7E]" />
            </div>
            <p className="text-[11px] text-[#9DA2B0] font-medium">No secrets yet</p>
            <p className="text-[10px] text-[#4A5068] mt-1">Add environment variables for API keys and secrets</p>
            <Button
              variant="ghost"
              className="mt-3 h-7 px-3 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10 rounded gap-1"
              onClick={() => setAddMode(true)}
              data-testid="button-add-first-env-var"
            >
              <Plus className="w-3 h-3" />
              Add Secret
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#2B3245]/50">
            {envVars.map((envVar) => (
              <div key={envVar.id} className="px-3 py-2 hover:bg-[#2B3245]/20 transition-colors group" data-testid={`env-var-${envVar.key}`}>
                {editingId === envVar.id ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-[#F5A623] font-mono font-bold">{envVar.key}</span>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      type="password"
                      className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
                      autoFocus
                      data-testid={`input-edit-env-${envVar.key}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editValue.trim()) updateMutation.mutate({ id: envVar.id, value: editValue });
                        if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        className="h-6 px-2 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white rounded gap-1"
                        onClick={() => { if (editValue.trim()) updateMutation.mutate({ id: envVar.id, value: editValue }); }}
                        disabled={!editValue.trim() || updateMutation.isPending}
                        data-testid={`button-save-edit-${envVar.key}`}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-[#676D7E] hover:text-[#F5F9FC]"
                        onClick={() => { setEditingId(null); setEditValue(""); }}
                        data-testid={`button-cancel-edit-${envVar.key}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-[#F5A623] font-mono font-medium block truncate" data-testid={`text-env-key-${envVar.key}`}>{envVar.key}</span>
                      <span className="text-[10px] text-[#676D7E] font-mono block truncate" data-testid={`text-env-value-${envVar.key}`}>
                        {showValues.has(envVar.id) ? envVar.encryptedValue : "••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className="p-1 text-[#676D7E] hover:text-[#9DA2B0] rounded hover:bg-[#2B3245]"
                        onClick={() => toggleShowValue(envVar.id)}
                        title={showValues.has(envVar.id) ? "Hide value" : "Show value"}
                        data-testid={`button-toggle-env-${envVar.key}`}
                      >
                        {showValues.has(envVar.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        className="p-1 text-[#676D7E] hover:text-[#0079F2] rounded hover:bg-[#2B3245]"
                        onClick={() => { setEditingId(envVar.id); setEditValue(envVar.encryptedValue); }}
                        title="Edit value"
                        data-testid={`button-edit-env-${envVar.key}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 text-[#676D7E] hover:text-red-400 rounded hover:bg-[#2B3245]"
                        onClick={() => deleteMutation.mutate(envVar.id)}
                        title="Delete"
                        data-testid={`button-delete-env-${envVar.key}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {envVars.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[#2B3245] shrink-0">
          <Button
            variant="ghost"
            className="h-6 px-2 text-[9px] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded gap-1"
            onClick={() => setBulkMode("json")}
            data-testid="button-edit-as-json"
          >
            <FileJson className="w-3 h-3" />
            Edit as JSON
          </Button>
          <Button
            variant="ghost"
            className="h-6 px-2 text-[9px] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded gap-1"
            onClick={() => setBulkMode("env")}
            data-testid="button-edit-as-env"
          >
            <FileText className="w-3 h-3" />
            Edit as .env
          </Button>
        </div>
      )}
    </div>
  );
}

function AccountSecretsTab({ projectId, externalAddMode, onAddModeChange }: { projectId: string; externalAddMode: boolean; onAddModeChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const addMode = externalAddMode;
  const setAddMode = onAddModeChange;

  const accountEnvVarsQuery = useQuery<AccountEnvVar[]>({
    queryKey: ["/api/account/env-vars"],
    queryFn: async () => {
      const res = await fetch("/api/account/env-vars", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load account env vars");
      return res.json();
    },
  });

  const linkedVarsQuery = useQuery<LinkedAccountVar[]>({
    queryKey: ["/api/projects", projectId, "linked-account-vars"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/linked-account-vars`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load linked vars");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await apiRequest("POST", "/api/account/env-vars", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/env-vars"] });
      setNewKey("");
      setNewValue("");
      setAddMode(false);
      toast({ title: "Account secret added" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      await apiRequest("PATCH", `/api/account/env-vars/${id}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/env-vars"] });
      setEditingId(null);
      setEditValue("");
      toast({ title: "Account secret updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/account/env-vars/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/env-vars"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "linked-account-vars"] });
      toast({ title: "Account secret deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (accountEnvVarId: string) => {
      await apiRequest("POST", `/api/account/env-vars/${accountEnvVarId}/link`, { projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "linked-account-vars"] });
      toast({ title: "Secret linked to project" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to link", description: err.message, variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (accountEnvVarId: string) => {
      await apiRequest("DELETE", `/api/account/env-vars/${accountEnvVarId}/link/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "linked-account-vars"] });
      toast({ title: "Secret unlinked from project" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

  const toggleShowValue = (id: string) => {
    setShowValues(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const accountEnvVars = accountEnvVarsQuery.data || [];
  const linkedVarIds = new Set((linkedVarsQuery.data || []).map(l => l.accountEnvVarId));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2 border-b border-[#2B3245]">
        <p className="text-[9px] text-[#4A5068] leading-relaxed">
          Account secrets are shared across projects. Link them to this project to make them available during code execution.
        </p>
      </div>

      {addMode && (
        <div className="px-3 py-2.5 border-b border-[#2B3245] bg-[#0E1525]/50" data-testid="account-env-var-add-form">
          <div className="space-y-2">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              placeholder="KEY_NAME"
              className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
              autoFocus
              data-testid="input-account-env-key"
            />
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value"
              type="password"
              className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
              data-testid="input-account-env-value"
            />
            <div className="flex items-center gap-1.5">
              <Button
                className="flex-1 h-7 text-[10px] bg-[#0CCE6B] hover:bg-[#0BBF62] text-[#0E1525] rounded font-medium gap-1"
                onClick={() => {
                  if (newKey.trim() && newValue.trim()) {
                    createMutation.mutate({ key: newKey.trim(), value: newValue });
                  }
                }}
                disabled={!newKey.trim() || !newValue.trim() || createMutation.isPending}
                data-testid="button-save-account-env-var"
              >
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Add Secret
              </Button>
              <Button
                variant="ghost"
                className="h-7 px-2 text-[10px] text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245] rounded"
                onClick={() => { setAddMode(false); setNewKey(""); setNewValue(""); }}
                data-testid="button-cancel-account-env-var"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {accountEnvVarsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-[#676D7E]" />
        </div>
      ) : accountEnvVars.length === 0 && !addMode ? (
        <div className="px-3 py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#0E1525] border border-[#2B3245] flex items-center justify-center mx-auto mb-2">
            <Key className="w-5 h-5 text-[#676D7E]" />
          </div>
          <p className="text-[11px] text-[#9DA2B0] font-medium">No account secrets</p>
          <p className="text-[10px] text-[#4A5068] mt-1">Account secrets can be shared across multiple projects</p>
          <Button
            variant="ghost"
            className="mt-3 h-7 px-3 text-[10px] text-[#0079F2] hover:bg-[#0079F2]/10 rounded gap-1"
            onClick={() => setAddMode(true)}
            data-testid="button-add-first-account-env-var"
          >
            <Plus className="w-3 h-3" />
            Add Account Secret
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-[#2B3245]/50">
          {accountEnvVars.map((envVar) => {
            const isLinked = linkedVarIds.has(envVar.id);
            return (
              <div key={envVar.id} className="px-3 py-2 hover:bg-[#2B3245]/20 transition-colors group" data-testid={`account-env-var-${envVar.key}`}>
                {editingId === envVar.id ? (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-[#F5A623] font-mono font-bold">{envVar.key}</span>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      type="password"
                      className="bg-[#0E1525] border-[#2B3245] h-7 text-[11px] text-[#F5F9FC] font-mono rounded focus:border-[#0079F2]"
                      autoFocus
                      data-testid={`input-edit-account-env-${envVar.key}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editValue.trim()) updateMutation.mutate({ id: envVar.id, value: editValue });
                        if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        className="h-6 px-2 text-[10px] bg-[#0079F2] hover:bg-[#0079F2]/90 text-white rounded gap-1"
                        onClick={() => { if (editValue.trim()) updateMutation.mutate({ id: envVar.id, value: editValue }); }}
                        disabled={!editValue.trim() || updateMutation.isPending}
                        data-testid={`button-save-edit-account-${envVar.key}`}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-[#676D7E] hover:text-[#F5F9FC]"
                        onClick={() => { setEditingId(null); setEditValue(""); }}
                        data-testid={`button-cancel-edit-account-${envVar.key}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[#F5A623] font-mono font-medium truncate" data-testid={`text-account-env-key-${envVar.key}`}>{envVar.key}</span>
                        {isLinked && (
                          <span className="text-[8px] bg-[#0CCE6B]/20 text-[#0CCE6B] px-1 py-0.5 rounded" data-testid={`badge-linked-${envVar.key}`}>
                            linked
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#676D7E] font-mono block truncate" data-testid={`text-account-env-value-${envVar.key}`}>
                        {showValues.has(envVar.id) ? envVar.encryptedValue : "••••••••"}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        className={`p-1 rounded hover:bg-[#2B3245] ${isLinked ? "text-[#0CCE6B] hover:text-red-400" : "text-[#676D7E] hover:text-[#0CCE6B]"}`}
                        onClick={() => isLinked ? unlinkMutation.mutate(envVar.id) : linkMutation.mutate(envVar.id)}
                        title={isLinked ? "Unlink from project" : "Link to project"}
                        data-testid={`button-link-toggle-${envVar.key}`}
                      >
                        {isLinked ? <Unlink className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      </button>
                      <button
                        className="p-1 text-[#676D7E] hover:text-[#9DA2B0] rounded hover:bg-[#2B3245]"
                        onClick={() => toggleShowValue(envVar.id)}
                        title={showValues.has(envVar.id) ? "Hide value" : "Show value"}
                        data-testid={`button-toggle-account-env-${envVar.key}`}
                      >
                        {showValues.has(envVar.id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        className="p-1 text-[#676D7E] hover:text-[#0079F2] rounded hover:bg-[#2B3245]"
                        onClick={() => { setEditingId(envVar.id); setEditValue(envVar.encryptedValue); }}
                        title="Edit value"
                        data-testid={`button-edit-account-env-${envVar.key}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 text-[#676D7E] hover:text-red-400 rounded hover:bg-[#2B3245]"
                        onClick={() => deleteMutation.mutate(envVar.id)}
                        title="Delete"
                        data-testid={`button-delete-account-env-${envVar.key}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EnvVarsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabType>("app");
  const [appAddMode, setAppAddMode] = useState(false);
  const [accountAddMode, setAccountAddMode] = useState(false);

  const handleAddClick = () => {
    if (activeTab === "app") {
      setAppAddMode(true);
    } else {
      setAccountAddMode(true);
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="env-vars-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
        <div className="flex items-center gap-1.5">
          <Key className="w-3.5 h-3.5 text-[#F5A623]" />
          <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest">Secrets</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[#676D7E] hover:text-[#0CCE6B] hover:bg-[#2B3245]"
            onClick={handleAddClick}
            data-testid="button-add-env-var"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-6 h-6 text-[#676D7E] hover:text-[#F5F9FC] hover:bg-[#2B3245]"
            onClick={onClose}
            data-testid="button-close-env-vars"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex border-b border-[#2B3245] shrink-0">
        <button
          className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${
            activeTab === "app"
              ? "text-[#F5F9FC] border-b-2 border-[#0079F2]"
              : "text-[#676D7E] hover:text-[#9DA2B0]"
          }`}
          onClick={() => setActiveTab("app")}
          data-testid="tab-app-secrets"
        >
          App Secrets
        </button>
        <button
          className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${
            activeTab === "account"
              ? "text-[#F5F9FC] border-b-2 border-[#0079F2]"
              : "text-[#676D7E] hover:text-[#9DA2B0]"
          }`}
          onClick={() => setActiveTab("account")}
          data-testid="tab-account-secrets"
        >
          Account Secrets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "app" ? (
          <AppSecretsTab projectId={projectId} externalAddMode={appAddMode} onAddModeChange={setAppAddMode} />
        ) : (
          <AccountSecretsTab projectId={projectId} externalAddMode={accountAddMode} onAddModeChange={setAccountAddMode} />
        )}
      </div>
    </div>
  );
}
