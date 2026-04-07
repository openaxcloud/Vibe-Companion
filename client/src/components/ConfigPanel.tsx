import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Settings, Save, RotateCcw, Plus, X, Loader2, Globe, Terminal,
  Play, Box, Eye, EyeOff, ChevronDown, ChevronRight, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCSRFToken } from "@/lib/queryClient";

interface ConfigPanelProps {
  projectId: string;
  onClose: () => void;
}

interface PortConfig {
  localPort: number;
  externalPort?: number;
  name?: string;
}

interface ReplitConfig {
  run?: string;
  entrypoint?: string;
  language?: string;
  onBoot?: string;
  hidden?: string[];
  modules?: string[];
  audio?: boolean;
  networking?: boolean;
  compile?: string;
  runEnv?: Record<string, string>;
  nix?: { channel?: string };
  packager?: {
    language?: string;
    guessImports?: boolean;
    packageSearch?: boolean;
    afterInstall?: string;
    ignoredPackages?: string[];
    ignoredPaths?: string[];
    enabledForHosting?: boolean;
  };
  deployment?: {
    deploymentTarget?: string;
    run?: string;
    build?: string;
    ignorePorts?: number[];
  };
  unitTest?: { language?: string };
  languages?: Record<string, { pattern?: string; syntax?: string }>;
  ports?: PortConfig[];
}

function SectionHeader({ title, icon: Icon, expanded, onToggle, iconColor = "text-blue-400" }: {
  title: string; icon: any; expanded: boolean; onToggle: () => void; iconColor?: string;
}) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-[var(--ide-surface)]/30 transition-colors" data-testid={`section-${title.toLowerCase().replace(/\s/g, '-')}`}>
      {expanded ? <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)]" /> : <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)]" />}
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-wider">{title}</span>
    </button>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default function ConfigPanel({ projectId, onClose }: ConfigPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<ReplitConfig>({});
  const [isDirty, setIsDirty] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    execution: true, environment: false, packager: false, ports: false, hidden: false, nix: false
  });
  const [nixDepInput, setNixDepInput] = useState("");
  const [nixDeps, setNixDeps] = useState<string[]>([]);

  const configQuery = useQuery<{ replit: ReplitConfig; nix: any; raw: { replit: string; nix: string }; hasReplitFile: boolean; hasNixFile: boolean }>({
    queryKey: ["/api/projects", projectId, "config"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/config`, { credentials: "include" });
      if (!res.ok) return { replit: {}, nix: {}, raw: { replit: "", nix: "" }, hasReplitFile: false, hasNixFile: false };
      return res.json();
    },
  });

  useEffect(() => {
    if (configQuery.data?.replit) {
      setLocalConfig(configQuery.data.replit);
      setIsDirty(false);
    }
    if (configQuery.data?.nix?.deps) {
      setNixDeps(configQuery.data.nix.deps);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (config: ReplitConfig) => {
      const csrf = await getCSRFToken();
      const res = await fetch(`/api/projects/${projectId}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(csrf ? { "x-csrf-token": csrf } : {}) } as HeadersInit,
        credentials: "include",
        body: JSON.stringify({ replit: config, nix: { deps: nixDeps } }),
      });
      if (!res.ok) throw new Error("Failed to save config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "config"] });
      setIsDirty(false);
      toast({ title: "Config saved", description: ".replit configuration updated" });
    },
    onError: () => {
      toast({ title: "Save failed", variant: "destructive" });
    },
  });

  const updateField = (path: string, value: any) => {
    setLocalConfig(prev => {
      const next = { ...prev };
      const keys = path.split(".");
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      if (value === "" || value === undefined) {
        delete obj[keys[keys.length - 1]];
      } else {
        obj[keys[keys.length - 1]] = value;
      }
      return next;
    });
    setIsDirty(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const inputCls = "h-6 text-[11px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded placeholder:text-[var(--ide-text-muted)]";

  return (
    <div className="flex flex-col h-full bg-[var(--ide-panel)]" data-testid="config-panel">
      <div className="flex items-center justify-between px-3 h-8 border-b border-[var(--ide-border)] bg-[var(--ide-bg)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-[#F5A623]" />
          <span className="text-[11px] text-[var(--ide-text-secondary)] font-medium">.replit Config</span>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#F5A623]" />}
        </div>
        <div className="flex items-center gap-1">
          {isDirty && (
            <>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={() => { setLocalConfig(configQuery.data?.replit || {}); setIsDirty(false); }} data-testid="button-reset-config" title="Discard changes">
                <RotateCcw className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-[#0CCE6B] hover:bg-[#0CCE6B]/10" onClick={() => saveMutation.mutate(localConfig)} disabled={saveMutation.isPending} data-testid="button-save-config" title="Save config">
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="w-6 h-6 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]" onClick={onClose} data-testid="button-close-config">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {configQuery.isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--ide-text-muted)]" /></div>
        ) : (
          <>
            <SectionHeader title="Execution" icon={Play} expanded={expandedSections.execution} onToggle={() => toggleSection("execution")} iconColor="text-[#0CCE6B]" />
            {expandedSections.execution && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <FieldRow label="Run command">
                  <Input value={localConfig.run || ""} onChange={e => updateField("run", e.target.value)} placeholder="e.g. node index.js" className={inputCls} data-testid="input-run-command" />
                </FieldRow>
                <FieldRow label="Entrypoint">
                  <Input value={localConfig.entrypoint || ""} onChange={e => updateField("entrypoint", e.target.value)} placeholder="e.g. index.js" className={inputCls} data-testid="input-entrypoint" />
                </FieldRow>
                <FieldRow label="Language">
                  <Input value={localConfig.language || ""} onChange={e => updateField("language", e.target.value)} placeholder="e.g. nodejs" className={inputCls} data-testid="input-language" />
                </FieldRow>
                <FieldRow label="On Boot">
                  <Input value={localConfig.onBoot || ""} onChange={e => updateField("onBoot", e.target.value)} placeholder="e.g. npm install" className={inputCls} data-testid="input-onboot" />
                </FieldRow>
                <FieldRow label="Compile">
                  <Input value={localConfig.compile || ""} onChange={e => updateField("compile", e.target.value)} placeholder="e.g. make" className={inputCls} data-testid="input-compile" />
                </FieldRow>
              </div>
            )}

            <SectionHeader title="Environment" icon={Terminal} expanded={expandedSections.environment} onToggle={() => toggleSection("environment")} iconColor="text-purple-400" />
            {expandedSections.environment && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <FieldRow label="Deployment target">
                  <Input value={localConfig.deployment?.deploymentTarget || ""} onChange={e => updateField("deployment.deploymentTarget", e.target.value)} placeholder="e.g. static, cloudrun" className={inputCls} data-testid="input-deployment-target" />
                </FieldRow>
                <FieldRow label="Nix channel">
                  <Input value={localConfig.nix?.channel || ""} onChange={e => updateField("nix.channel", e.target.value)} placeholder="e.g. stable-24_05" className={inputCls} data-testid="input-nix-channel" />
                </FieldRow>
                <div className="px-3 py-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">Audio</label>
                    <button onClick={() => updateField("audio", !localConfig.audio)} className={`w-7 h-4 rounded-full transition-colors ${localConfig.audio ? 'bg-[#0CCE6B]' : 'bg-[var(--ide-border)]'} relative`} data-testid="toggle-audio">
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localConfig.audio ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">Networking</label>
                    <button onClick={() => updateField("networking", !localConfig.networking)} className={`w-7 h-4 rounded-full transition-colors ${localConfig.networking ? 'bg-[#0CCE6B]' : 'bg-[var(--ide-border)]'} relative`} data-testid="toggle-networking">
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localConfig.networking ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <EnvVarsSection env={localConfig.runEnv || {}} onChange={env => { updateField("runEnv", env); }} />
              </div>
            )}

            <SectionHeader title="Packager" icon={Box} expanded={expandedSections.packager} onToggle={() => toggleSection("packager")} iconColor="text-cyan-400" />
            {expandedSections.packager && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <FieldRow label="Language">
                  <Input value={localConfig.packager?.language || ""} onChange={e => updateField("packager.language", e.target.value)} placeholder="e.g. nodejs, python3" className={inputCls} data-testid="input-packager-language" />
                </FieldRow>
                <FieldRow label="After install">
                  <Input value={localConfig.packager?.afterInstall || ""} onChange={e => updateField("packager.afterInstall", e.target.value)} placeholder="e.g. npm run build" className={inputCls} data-testid="input-after-install" />
                </FieldRow>
                <div className="px-3 py-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">Guess imports</label>
                    <button onClick={() => updateField("packager.guessImports", !(localConfig.packager?.guessImports ?? true))} className={`w-7 h-4 rounded-full transition-colors ${(localConfig.packager?.guessImports ?? true) ? 'bg-[#0CCE6B]' : 'bg-[var(--ide-border)]'} relative`} data-testid="toggle-guess-imports">
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${(localConfig.packager?.guessImports ?? true) ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="px-3 py-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">Package search</label>
                    <button onClick={() => updateField("packager.packageSearch", !localConfig.packager?.packageSearch)} className={`w-7 h-4 rounded-full transition-colors ${localConfig.packager?.packageSearch ? 'bg-[#0CCE6B]' : 'bg-[var(--ide-border)]'} relative`} data-testid="toggle-package-search">
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localConfig.packager?.packageSearch ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-[var(--ide-text-muted)] w-28 shrink-0">Enabled for hosting</label>
                    <button onClick={() => updateField("packager.enabledForHosting", !localConfig.packager?.enabledForHosting)} className={`w-7 h-4 rounded-full transition-colors ${localConfig.packager?.enabledForHosting ? 'bg-[#0CCE6B]' : 'bg-[var(--ide-border)]'} relative`} data-testid="toggle-enabled-for-hosting">
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${localConfig.packager?.enabledForHosting ? 'left-3.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5">
                  <label className="text-[10px] text-[var(--ide-text-muted)]">Ignored packages</label>
                  <ListEditor items={localConfig.packager?.ignoredPackages || []} onChange={items => updateField("packager.ignoredPackages", items)} placeholder="e.g. some-pkg" testIdPrefix="ignored-pkg" />
                </div>
                <div className="mt-1.5">
                  <label className="text-[10px] text-[var(--ide-text-muted)]">Ignored paths</label>
                  <ListEditor items={localConfig.packager?.ignoredPaths || []} onChange={items => updateField("packager.ignoredPaths", items)} placeholder="e.g. vendor/" testIdPrefix="ignored-path" />
                </div>
              </div>
            )}

            <SectionHeader title="Ports" icon={Globe} expanded={expandedSections.ports} onToggle={() => toggleSection("ports")} iconColor="text-[#0079F2]" />
            {expandedSections.ports && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <PortsSection ports={localConfig.ports || []} onChange={ports => { updateField("ports", ports); }} />
              </div>
            )}

            <SectionHeader title="Hidden Files" icon={EyeOff} expanded={expandedSections.hidden} onToggle={() => toggleSection("hidden")} iconColor="text-[var(--ide-text-muted)]" />
            {expandedSections.hidden && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <ListEditor items={localConfig.hidden || []} onChange={items => updateField("hidden", items)} placeholder="e.g. .config, *.lock" testIdPrefix="hidden" />
              </div>
            )}

            <SectionHeader title="Nix Dependencies" icon={Package} expanded={expandedSections.nix} onToggle={() => toggleSection("nix")} iconColor="text-purple-400" />
            {expandedSections.nix && (
              <div className="border-b border-[var(--ide-border)]/50 pb-2">
                <div className="px-3 py-1">
                  <div className="flex gap-1 mb-1.5">
                    <Input
                      value={nixDepInput}
                      onChange={e => setNixDepInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && nixDepInput.trim()) {
                          const dep = nixDepInput.trim();
                          if (!nixDeps.includes(dep)) {
                            setNixDeps(prev => [...prev, dep]);
                            setIsDirty(true);
                          }
                          setNixDepInput("");
                        }
                      }}
                      placeholder="e.g. pkgs.nodejs-18_x"
                      className={inputCls}
                      data-testid="input-nix-dep"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => {
                        const dep = nixDepInput.trim();
                        if (dep && !nixDeps.includes(dep)) {
                          setNixDeps(prev => [...prev, dep]);
                          setIsDirty(true);
                        }
                        setNixDepInput("");
                      }}
                      data-testid="button-add-nix-dep"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                  {nixDeps.length === 0 && (
                    <p className="text-[10px] text-[var(--ide-text-muted)] italic">No Nix dependencies configured</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {nixDeps.map((dep, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[var(--ide-surface)] text-[10px] text-[var(--ide-text-secondary)] border border-[var(--ide-border)]" data-testid={`nix-dep-${i}`}>
                        {dep}
                        <button
                          onClick={() => {
                            setNixDeps(prev => prev.filter((_, j) => j !== i));
                            setIsDirty(true);
                          }}
                          className="ml-0.5 hover:text-red-400"
                          data-testid={`button-remove-nix-dep-${i}`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EnvVarsSection({ env, onChange }: { env: Record<string, string>; onChange: (env: Record<string, string>) => void }) {
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const entries = Object.entries(env);

  return (
    <div className="px-3 py-1">
      <div className="text-[9px] text-[var(--ide-text-muted)] mb-1 font-medium uppercase tracking-wider">Environment Variables</div>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1 mb-1" data-testid={`env-var-${key}`}>
          <span className="text-[10px] text-[#F5A623] font-mono w-24 truncate">{key}</span>
          <span className="text-[10px] text-[var(--ide-text-muted)]">=</span>
          <span className="text-[10px] text-[var(--ide-text)] font-mono flex-1 truncate">{val}</span>
          <Button variant="ghost" size="icon" className="w-4 h-4 text-[var(--ide-text-muted)] hover:text-red-400 shrink-0" onClick={() => { const next = { ...env }; delete next[key]; onChange(next); }} data-testid={`button-remove-env-${key}`}>
            <X className="w-2.5 h-2.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1 mt-1">
        <Input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="KEY" className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded w-24 font-mono" data-testid="input-new-env-key" />
        <span className="text-[10px] text-[var(--ide-text-muted)]">=</span>
        <Input value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value" className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded flex-1 font-mono" data-testid="input-new-env-value" />
        <Button variant="ghost" size="icon" className="w-5 h-5 text-[#0CCE6B] hover:bg-[#0CCE6B]/10 shrink-0" onClick={() => { if (newKey.trim()) { onChange({ ...env, [newKey.trim()]: newVal }); setNewKey(""); setNewVal(""); } }} data-testid="button-add-env-var">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function PortsSection({ ports, onChange }: { ports: PortConfig[]; onChange: (ports: PortConfig[]) => void }) {
  const [newLocal, setNewLocal] = useState("");
  const [newExternal, setNewExternal] = useState("");
  const [newName, setNewName] = useState("");

  return (
    <div className="px-3 py-1">
      {ports.map((port, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1" data-testid={`port-entry-${i}`}>
          <span className="text-[10px] text-[#0079F2] font-mono">{port.localPort}</span>
          {port.externalPort && <><span className="text-[10px] text-[var(--ide-text-muted)]">→</span><span className="text-[10px] text-[var(--ide-text)] font-mono">{port.externalPort}</span></>}
          {port.name && <span className="text-[9px] text-[var(--ide-text-muted)] px-1 bg-[var(--ide-surface)] rounded">{port.name}</span>}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="w-4 h-4 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => onChange(ports.filter((_, j) => j !== i))} data-testid={`button-remove-port-${i}`}>
            <X className="w-2.5 h-2.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1 mt-1">
        <Input value={newLocal} onChange={e => setNewLocal(e.target.value)} placeholder="Local" className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded w-14 font-mono" type="number" data-testid="input-new-port-local" />
        <span className="text-[10px] text-[var(--ide-text-muted)]">→</span>
        <Input value={newExternal} onChange={e => setNewExternal(e.target.value)} placeholder="Ext" className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded w-14 font-mono" type="number" data-testid="input-new-port-external" />
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded flex-1" data-testid="input-new-port-name" />
        <Button variant="ghost" size="icon" className="w-5 h-5 text-[#0079F2] hover:bg-[#0079F2]/10 shrink-0" onClick={() => {
          const local = parseInt(newLocal);
          if (local > 0) {
            const ext = parseInt(newExternal) || undefined;
            onChange([...ports, { localPort: local, externalPort: ext, name: newName || undefined }]);
            setNewLocal(""); setNewExternal(""); setNewName("");
          }
        }} data-testid="button-add-port">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      {ports.length === 0 && <p className="text-[9px] text-[var(--ide-text-muted)] mt-1">No ports configured. Add port mappings for your application.</p>}
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, testIdPrefix }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; testIdPrefix: string }) {
  const [newItem, setNewItem] = useState("");

  return (
    <div className="px-3 py-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5" data-testid={`${testIdPrefix}-item-${i}`}>
          <span className="text-[10px] text-[var(--ide-text)] font-mono flex-1">{item}</span>
          <Button variant="ghost" size="icon" className="w-4 h-4 text-[var(--ide-text-muted)] hover:text-red-400" onClick={() => onChange(items.filter((_, j) => j !== i))} data-testid={`button-remove-${testIdPrefix}-${i}`}>
            <X className="w-2.5 h-2.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-1 mt-1">
        <Input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { onChange([...items, newItem.trim()]); setNewItem(""); } }} placeholder={placeholder} className="h-5 text-[10px] bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)] rounded flex-1 font-mono" data-testid={`input-new-${testIdPrefix}`} />
        <Button variant="ghost" size="icon" className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] shrink-0" onClick={() => { if (newItem.trim()) { onChange([...items, newItem.trim()]); setNewItem(""); } }} data-testid={`button-add-${testIdPrefix}`}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}