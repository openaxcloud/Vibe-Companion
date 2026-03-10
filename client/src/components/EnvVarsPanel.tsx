import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Eye, EyeOff, Loader2, Key, Lock, X, Check, Pencil,
} from "lucide-react";

interface EnvVar {
  id: string;
  projectId: string;
  key: string;
  encryptedValue: string;
  createdAt: string;
}

export default function EnvVarsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showValues, setShowValues] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [addMode, setAddMode] = useState(false);

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
            onClick={() => setAddMode(true)}
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

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 border-b border-[#2B3245]">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="w-3 h-3 text-[#676D7E]" />
            <span className="text-[10px] text-[#676D7E]">Values are encrypted at rest</span>
          </div>
          <p className="text-[9px] text-[#4A5068] leading-relaxed">
            Environment variables are injected into code execution. Access them via <code className="text-[#9DA2B0] bg-[#0E1525] px-1 rounded">process.env.KEY</code> (JS/TS) or <code className="text-[#9DA2B0] bg-[#0E1525] px-1 rounded">os.environ['KEY']</code> (Python).
          </p>
        </div>

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
    </div>
  );
}
