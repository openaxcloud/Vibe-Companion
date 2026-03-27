import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCsrfToken } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, Github, Figma, Upload, Zap, Heart, Triangle,
  Loader2, CheckCircle2, AlertTriangle, FileArchive, X, ChevronRight,
  ExternalLink, Key, Plus, Trash2
} from "lucide-react";

type ImportSource = "github" | "figma" | "vercel" | "bolt" | "lovable" | "zip";

interface ImportSourceConfig {
  id: ImportSource;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  placeholder: string;
  inputType: "url" | "file";
}

const IMPORT_SOURCES: ImportSourceConfig[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Import from a GitHub repository with full file tree support",
    icon: <Github className="w-6 h-6" />,
    color: "#24292f",
    placeholder: "https://github.com/owner/repo",
    inputType: "url",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Generate React components from a Figma design file",
    icon: <Figma className="w-6 h-6" />,
    color: "#A259FF",
    placeholder: "https://www.figma.com/file/...",
    inputType: "url",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Import a Vercel project via its linked GitHub repository",
    icon: <Triangle className="w-6 h-6" />,
    color: "#000000",
    placeholder: "https://vercel.com/team/project or project.vercel.app",
    inputType: "url",
  },
  {
    id: "bolt",
    name: "Bolt",
    description: "Import a Bolt project from its GitHub export repository",
    icon: <Zap className="w-6 h-6" />,
    color: "#FFB800",
    placeholder: "https://github.com/owner/bolt-project",
    inputType: "url",
  },
  {
    id: "lovable",
    name: "Lovable",
    description: "Import a Lovable project from its GitHub export repository",
    icon: <Heart className="w-6 h-6" />,
    color: "#FF4D6A",
    placeholder: "https://github.com/owner/lovable-project",
    inputType: "url",
  },
  {
    id: "zip",
    name: "ZIP Upload",
    description: "Upload a ZIP file containing your project files",
    icon: <FileArchive className="w-6 h-6" />,
    color: "#0079F2",
    placeholder: "",
    inputType: "file",
  },
];

type Step = "select" | "input" | "envvars" | "importing" | "complete" | "error";

interface EnvVar {
  key: string;
  value: string;
}

export default function Import() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const preselectedSource = params.get("source") as ImportSource | null;

  const { toast } = useToast();

  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(preselectedSource);
  const [step, setStep] = useState<Step>(preselectedSource ? "input" : "select");
  const [inputUrl, setInputUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<any>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [requiredSecrets, setRequiredSecrets] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressData, setProgressData] = useState<{
    progress: number;
    totalFiles: number;
    importedFiles: number;
    currentFile: string;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const sourceConfig = selectedSource ? IMPORT_SOURCES.find(s => s.id === selectedSource) : null;

  const selectSource = (source: ImportSource) => {
    setSelectedSource(source);
    setStep("input");
    setInputUrl("");
    setProjectName("");
    setZipFile(null);
    setValidation(null);
    setError("");
    setResult(null);
    setEnvVars([]);
    setRequiredSecrets([]);
  };

  const goBack = () => {
    if (step === "input") {
      setStep("select");
      setSelectedSource(null);
    } else if (step === "envvars") {
      setStep("input");
    } else if (step === "complete" || step === "error") {
      setStep("input");
      setError("");
      setResult(null);
    }
  };

  const validateInput = useCallback(async () => {
    if (!selectedSource || !inputUrl.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const res = await apiRequest("POST", "/api/import/validate", { source: selectedSource, input: inputUrl.trim() });
      const data = await res.json();
      setValidation(data);
    } catch {
      setValidation({ valid: false, compatible: false, reasons: ["Validation failed"] });
    } finally {
      setValidating(false);
    }
  }, [selectedSource, inputUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".zip")) {
        toast({ title: "Invalid file", description: "Please select a .zip file", variant: "destructive" });
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum ZIP file size is 50MB", variant: "destructive" });
        return;
      }
      setZipFile(file);
      if (!projectName) {
        setProjectName(file.name.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 50));
      }
    }
  };

  const addEnvVar = () => {
    setEnvVars(prev => [...prev, { key: "", value: "" }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(prev => prev.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: "key" | "value", val: string) => {
    setEnvVars(prev => prev.map((ev, i) => i === index ? { ...ev, [field]: val } : ev));
  };

  const runValidation = async (): Promise<{ valid: boolean; compatible: boolean; reasons?: string[] } | null> => {
    if (!selectedSource) return null;
    if (selectedSource === "zip") {
      if (!zipFile) return null;
      try {
        setValidating(true);
        const formData = new FormData();
        formData.append("file", zipFile);
        const csrfToken = getCsrfToken();
        const zipValHeaders: Record<string, string> = {};
        if (csrfToken) zipValHeaders["X-CSRF-Token"] = csrfToken;
        const res = await fetch("/api/import/validate-zip", { method: "POST", body: formData, credentials: "include", headers: zipValHeaders });
        const data = await res.json();
        setValidation(data);
        return data;
      } catch {
        const result = { valid: false, compatible: false, reasons: ["Validation failed"] };
        setValidation(result);
        return result;
      } finally {
        setValidating(false);
      }
    }
    if (!inputUrl.trim()) return null;
    try {
      setValidating(true);
      const res = await apiRequest("POST", "/api/import/validate", { source: selectedSource, input: inputUrl.trim() });
      const data = await res.json();
      setValidation(data);
      return data;
    } catch {
      const result = { valid: false, compatible: false, reasons: ["Validation failed"] };
      setValidation(result);
      return result;
    } finally {
      setValidating(false);
    }
  };

  const startImport = async () => {
    if (!selectedSource) return;

    const validationResult = await runValidation();
    if (!validationResult || !validationResult.valid) {
      toast({ title: "Validation failed", description: validationResult?.reasons?.join(" ") || "Please fix the issues before importing.", variant: "destructive" });
      return;
    }
    if (!validationResult.compatible) {
      toast({ title: "Incompatible source", description: validationResult.reasons?.join(" ") || "This source is not compatible for import.", variant: "destructive" });
      return;
    }

    setImporting(true);
    setError("");
    setProgress("Preparing import...");
    setStep("importing");
    setJobId(null);
    setProgressData(null);

    try {
      let data: any;

      if (selectedSource === "zip") {
        if (!zipFile) throw new Error("No ZIP file selected");
        setProgress("Uploading ZIP file...");
        const formData = new FormData();
        formData.append("file", zipFile);
        formData.append("name", projectName || "zip-import");
        const zipCsrf = getCsrfToken();
        const zipHeaders: Record<string, string> = {};
        if (zipCsrf) zipHeaders["X-CSRF-Token"] = zipCsrf;
        const res = await fetch("/api/import/zip", { method: "POST", body: formData, credentials: "include", headers: zipHeaders });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "ZIP import failed");
        }
        data = await res.json();
      } else if (selectedSource === "github") {
        setProgress("Starting import...");
        const urlMatch = inputUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!urlMatch) throw new Error("Invalid GitHub URL");
        const res = await apiRequest("POST", "/api/github/import", {
          owner: urlMatch[1],
          repo: urlMatch[2].replace(".git", ""),
          name: projectName || undefined,
          async: true,
        });
        data = await res.json();
      } else if (selectedSource === "figma") {
        setProgress("Fetching Figma design context...");
        let designContext: string | undefined;
        try {
          const ctxRes = await apiRequest("POST", "/api/import/figma/design-context", { url: inputUrl.trim() });
          const ctxData = await ctxRes.json();
          designContext = ctxData.designContext;
        } catch (ctxErr: any) {
          throw new Error(ctxErr.message || "Failed to fetch Figma design context. Check your Figma integration.");
        }
        setProgress("Generating React components from design...");
        const res = await apiRequest("POST", "/api/import/figma", {
          url: inputUrl.trim(),
          name: projectName || "figma-import",
          designContext,
        });
        data = await res.json();
      } else if (selectedSource === "vercel") {
        setProgress("Starting Vercel import...");
        const res = await apiRequest("POST", "/api/import/vercel", {
          url: inputUrl.trim(),
          name: projectName || undefined,
        });
        data = await res.json();
      } else if (selectedSource === "bolt") {
        setProgress("Starting Bolt import...");
        const res = await apiRequest("POST", "/api/import/bolt", {
          url: inputUrl.trim(),
          name: projectName || undefined,
        });
        data = await res.json();
      } else if (selectedSource === "lovable") {
        setProgress("Starting Lovable import...");
        const res = await apiRequest("POST", "/api/import/lovable", {
          url: inputUrl.trim(),
          name: projectName || undefined,
        });
        data = await res.json();
      }

      if (data?.async && data?.jobId) {
        setJobId(data.jobId);
        setProgress("Import started, tracking progress...");
        const controller = new AbortController();
        abortRef.current = controller;
        const pollForCompletion = async (): Promise<any> => {
          const maxAttempts = 300;
          for (let i = 0; i < maxAttempts; i++) {
            if (controller.signal.aborted) throw new Error("Import cancelled");
            await new Promise(r => setTimeout(r, 1000));
            if (controller.signal.aborted) throw new Error("Import cancelled");
            const pollRes = await fetch(`/api/import/progress/${data.jobId}`, { credentials: "include", signal: controller.signal });
            if (!pollRes.ok) {
              if (pollRes.status === 401 || pollRes.status === 403) throw new Error("Session expired. Please log in again.");
              if (pollRes.status === 404) throw new Error("Import job not found.");
              continue;
            }
            const jobData = await pollRes.json();
            setProgressData(jobData);
            setProgress(jobData.message || "Importing...");
            if (jobData.status === "complete") {
              return jobData.result;
            }
            if (jobData.status === "error") {
              throw new Error(jobData.error || "Import failed");
            }
          }
          throw new Error("Import timed out after 5 minutes");
        };
        try {
          data = await pollForCompletion();
        } finally {
          abortRef.current = null;
        }
      } else if (data?.jobId) {
        setJobId(data.jobId);
      }

      if (data?.requiredSecrets?.length > 0) {
        setRequiredSecrets(data.requiredSecrets);
        if (envVars.length === 0) {
          setEnvVars(data.requiredSecrets.map((s: string) => ({ key: s, value: "" })));
          setResult(data);
          setStep("envvars");
          setImporting(false);
          return;
        }
      }

      if (envVars.length > 0 && data?.project?.id) {
        setProgress("Setting environment variables...");
        const envRecord: Record<string, string> = {};
        for (const ev of envVars) {
          if (ev.key.trim() && ev.value.trim()) {
            envRecord[ev.key.trim()] = ev.value.trim();
          }
        }
        if (Object.keys(envRecord).length > 0) {
          try {
            await apiRequest("PUT", `/api/projects/${data.project.id}/env-vars/bulk`, { vars: envRecord });
          } catch (envErr: unknown) {
            const envMsg = envErr instanceof Error ? envErr.message : "Unknown error";
            if (!data.warnings) data.warnings = [];
            data.warnings.push(`Failed to set some environment variables: ${envMsg}`);
          }
        }
      }

      setResult(data);
      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Import failed");
      setStep("error");
    } finally {
      setImporting(false);
    }
  };

  const finishWithEnvVars = async () => {
    if (!result?.project?.id) return;
    setImporting(true);
    setProgress("Setting environment variables...");

    try {
      const envRecord: Record<string, string> = {};
      for (const ev of envVars) {
        if (ev.key.trim() && ev.value.trim()) {
          envRecord[ev.key.trim()] = ev.value.trim();
        }
      }
      if (Object.keys(envRecord).length > 0) {
        try {
          await apiRequest("PUT", `/api/projects/${result.project.id}/env-vars/bulk`, { vars: envRecord });
        } catch (envErr: unknown) {
          const envMsg = envErr instanceof Error ? envErr.message : "Unknown error";
          if (!result.warnings) result.warnings = [];
          result.warnings.push(`Failed to set some environment variables: ${envMsg}`);
        }
      }
      setStep("complete");
    } catch (err: any) {
      setError(err.message || "Failed to set environment variables");
      setStep("error");
    } finally {
      setImporting(false);
    }
  };

  const canImport = () => {
    if (selectedSource === "zip") return !!zipFile;
    return inputUrl.trim().length > 0;
  };

  return (
    <div className="min-h-screen bg-[var(--ide-bg)] text-[var(--ide-text)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="text-[var(--ide-text-muted)] hover:text-[var(--ide-text)]"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-import-title">Import Project</h1>
            <p className="text-sm text-[var(--ide-text-muted)] mt-0.5">Import your project from an external source</p>
          </div>
        </div>

        {step === "select" && (
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="import-source-grid">
            {IMPORT_SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => selectSource(source.id)}
                className="group relative flex flex-col items-start p-5 rounded-xl border shadow-sm hover:shadow-lg transition-all duration-300 border-[var(--ide-border)] bg-[var(--ide-panel)] hover:border-[#0079F2]/50 hover:bg-[var(--ide-surface)] transition-all text-left"
                data-testid={`card-import-${source.id}`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${source.color}20`, color: source.color }}
                >
                  {source.icon}
                </div>
                <h3 className="text-sm font-semibold text-[var(--ide-text)] mb-1">{source.name}</h3>
                <p className="text-xs text-[var(--ide-text-muted)] leading-relaxed">{source.description}</p>
                <ChevronRight className="absolute top-5 right-4 w-4 h-4 text-[var(--ide-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {step === "input" && sourceConfig && (
          <div className="max-w-lg mx-auto" data-testid="import-input-form">
            <button onClick={goBack} className="flex items-center gap-1 text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] mb-6 transition-colors" data-testid="button-back-sources">
              <ArrowLeft className="w-3 h-3" /> Back to sources
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${sourceConfig.color}20`, color: sourceConfig.color }}
              >
                {sourceConfig.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold">Import from {sourceConfig.name}</h2>
                <p className="text-xs text-[var(--ide-text-muted)]">{sourceConfig.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--ide-text-muted)] font-medium block mb-1.5">Project Name (optional)</label>
                <Input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="my-project"
                  className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-sm"
                  data-testid="input-project-name"
                />
              </div>

              {sourceConfig.inputType === "url" ? (
                <div>
                  <label className="text-xs text-[var(--ide-text-muted)] font-medium block mb-1.5">
                    {sourceConfig.name} URL
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={inputUrl}
                      onChange={e => { setInputUrl(e.target.value); setValidation(null); }}
                      placeholder={sourceConfig.placeholder}
                      className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-sm flex-1"
                      data-testid="input-import-url"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateInput}
                      disabled={validating || !inputUrl.trim()}
                      className="h-9 text-xs"
                      data-testid="button-validate"
                    >
                      {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Validate"}
                    </Button>
                  </div>
                  {validation && (
                    <div className={`mt-2 px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${!validation.valid ? "bg-red-500/10 text-red-400" : !validation.compatible ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"}`} data-testid="text-validation-result">
                      {!validation.valid ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : !validation.compatible ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                      <div>
                        {!validation.valid ? (
                          <span>{validation.reasons?.join(". ") || "Invalid source"}</span>
                        ) : !validation.compatible ? (
                          <span>Source is valid but may not be compatible: {validation.reasons?.join(". ") || "Compatibility issue detected"}</span>
                        ) : (
                          <>
                            <span>Valid {sourceConfig.name} source{validation.detectedLanguage ? ` — detected ${validation.detectedLanguage}` : ""}{validation.fileCount ? ` (${validation.fileCount} files)` : ""}</span>
                            {validation.reasons?.length > 0 && (
                              <span className="block mt-1 text-yellow-400">{validation.reasons.join(". ")}</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-xs text-[var(--ide-text-muted)] font-medium block mb-1.5">ZIP File</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                    data-testid="input-zip-file"
                  />
                  <div
                    className="border-2 border-dashed border-[var(--ide-border)] rounded-xl p-6 text-center cursor-pointer hover:border-[#0079F2]/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-zip"
                  >
                    {zipFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileArchive className="w-8 h-8 text-[#0079F2]" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-[var(--ide-text)]">{zipFile.name}</p>
                          <p className="text-xs text-[var(--ide-text-muted)]">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={(e) => { e.stopPropagation(); setZipFile(null); }}
                          data-testid="button-remove-zip"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-[var(--ide-text-muted)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--ide-text-muted)]">Click to select a ZIP file</p>
                        <p className="text-xs text-[var(--ide-text-muted)] mt-1">Maximum 50MB, up to 500 text files</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-[var(--ide-border)] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[var(--ide-text-muted)] font-medium flex items-center gap-1">
                    <Key className="w-3 h-3" /> Environment Variables (optional)
                  </label>
                  <Button variant="ghost" size="sm" onClick={addEnvVar} className="h-6 text-[10px] gap-1" data-testid="button-add-env">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {envVars.map((ev, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Input
                      value={ev.key}
                      onChange={e => updateEnvVar(i, "key", e.target.value)}
                      placeholder="KEY"
                      className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 text-xs flex-1 font-mono"
                      data-testid={`input-env-key-${i}`}
                    />
                    <Input
                      value={ev.value}
                      onChange={e => updateEnvVar(i, "value", e.target.value)}
                      placeholder="value"
                      type="password"
                      className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-8 text-xs flex-1 font-mono"
                      data-testid={`input-env-value-${i}`}
                    />
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400" onClick={() => removeEnvVar(i)} data-testid={`button-remove-env-${i}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                className="w-full h-10 bg-[#0079F2] hover:bg-[#006AD8] text-white text-sm font-medium"
                onClick={startImport}
                disabled={!canImport() || importing}
                data-testid="button-start-import"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Import from {sourceConfig.name}
              </Button>
            </div>
          </div>
        )}

        {step === "envvars" && (
          <div className="max-w-lg mx-auto" data-testid="import-envvars-step">
            <button onClick={() => { setStep("complete"); }} className="flex items-center gap-1 text-xs text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] mb-6 transition-colors" data-testid="button-skip-envvars">
              <ChevronRight className="w-3 h-3" /> Skip this step
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Key className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Configure Environment Variables</h2>
                <p className="text-xs text-[var(--ide-text-muted)]">
                  {requiredSecrets.length} required secret(s) detected. Add values now or configure later in project settings.
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {envVars.map((ev, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={ev.key}
                    onChange={e => updateEnvVar(i, "key", e.target.value)}
                    placeholder="KEY"
                    className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-xs flex-1 font-mono"
                    data-testid={`input-envstep-key-${i}`}
                    readOnly={requiredSecrets.includes(ev.key)}
                  />
                  <Input
                    value={ev.value}
                    onChange={e => updateEnvVar(i, "value", e.target.value)}
                    placeholder="Enter value..."
                    type="password"
                    className="bg-[var(--ide-panel)] border-[var(--ide-border)] h-9 text-xs flex-1 font-mono"
                    data-testid={`input-envstep-value-${i}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setEnvVars([]); setStep("complete"); }}
                className="flex-1 text-sm"
                data-testid="button-skip-env-setup"
              >
                Skip for Now
              </Button>
              <Button
                className="flex-1 bg-[#0079F2] hover:bg-[#006AD8] text-white text-sm"
                onClick={finishWithEnvVars}
                disabled={importing}
                data-testid="button-save-env-vars"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save & Continue
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="max-w-lg mx-auto text-center py-16" data-testid="import-progress">
            <Loader2 className="w-12 h-12 animate-spin text-[#0079F2] mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Importing...</h2>
            <p className="text-sm text-[var(--ide-text-muted)]">{progress}</p>
            {progressData && progressData.totalFiles > 0 && (
              <div className="mt-4 space-y-2">
                <div className="w-full bg-[var(--ide-surface)] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-[#0079F2] rounded-full transition-all duration-300"
                    style={{ width: `${progressData.progress}%` }}
                    data-testid="progress-bar"
                  />
                </div>
                <p className="text-xs text-[var(--ide-text-muted)]" data-testid="text-progress-count">
                  {progressData.importedFiles} / {progressData.totalFiles} files ({progressData.progress}%)
                </p>
                {progressData.currentFile && (
                  <p className="text-[10px] text-[var(--ide-text-muted)] font-mono truncate" data-testid="text-current-file">
                    {progressData.currentFile}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === "complete" && result && (
          <div className="max-w-lg mx-auto text-center py-12" data-testid="import-complete">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Import Complete</h2>
            <p className="text-sm text-[var(--ide-text-muted)] mb-1">
              <span className="font-medium text-[var(--ide-text)]">{result.project?.name || result.fileCount + " files"}</span> imported successfully
            </p>
            <p className="text-xs text-[var(--ide-text-muted)] mb-6">{result.fileCount} file(s) imported</p>

            {result.warnings?.length > 0 && (
              <div className="mb-6 text-left bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                <h3 className="text-xs font-medium text-yellow-400 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-3 h-3" /> Warnings
                </h3>
                <ul className="space-y-1">
                  {result.warnings.map((w: string, i: number) => (
                    <li key={i} className="text-xs text-[var(--ide-text-muted)]">• {w}</li>
                  ))}
                </ul>
              </div>
            )}

            {(requiredSecrets.length > 0 || result.requiredSecrets?.length > 0) && (
              <div className="mb-6 text-left bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <h3 className="text-xs font-medium text-blue-400 flex items-center gap-1 mb-2">
                  <Key className="w-3 h-3" /> Required Secrets
                </h3>
                <p className="text-xs text-[var(--ide-text-muted)] mb-2">Add these in your project's environment variables:</p>
                <div className="flex flex-wrap gap-1">
                  {(result.requiredSecrets || requiredSecrets).map((s: string) => (
                    <span key={s} className="text-[10px] font-mono bg-[var(--ide-surface)] px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => { setStep("select"); setSelectedSource(null); setResult(null); }}
                className="text-sm"
                data-testid="button-import-another"
              >
                Import Another
              </Button>
              <Button
                className="bg-[#0079F2] hover:bg-[#006AD8] text-white text-sm"
                onClick={() => navigate(`/project/${result.project?.id}`)}
                data-testid="button-open-project"
              >
                Open Project <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="max-w-lg mx-auto text-center py-12" data-testid="import-error">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Import Failed</h2>
            <p className="text-sm text-red-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={goBack} className="text-sm" data-testid="button-try-again">
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStep("select"); setSelectedSource(null); setError(""); }}
                className="text-sm"
                data-testid="button-choose-different"
              >
                Choose Different Source
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
