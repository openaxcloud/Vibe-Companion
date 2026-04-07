import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";
import {
  Brain, Loader2, Plus, X, Search, ChevronDown, ChevronRight,
  Trash2, Pencil, Upload, FileText, Sparkles,
} from "lucide-react";

interface Skill {
  id: string;
  projectId: string;
  name: string;
  description: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface SkillsPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function SkillsPanel({ projectId, onClose }: SkillsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editContent, setEditContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const skillsQuery = useQuery<Skill[]>({
    queryKey: ["/api/skills", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/skills/${projectId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; content: string }) => {
      const res = await apiRequest("POST", `/api/skills/${projectId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", projectId] });
      setCreating(false);
      setNewName("");
      setNewDescription("");
      setNewContent("");
      toast({ title: "Skill created" });
    },
    onError: (err: any) => toast({ title: "Failed to create skill", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Skill> }) => {
      const res = await apiRequest("PUT", `/api/skills/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", projectId] });
      setEditingId(null);
      toast({ title: "Skill updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/skills/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/skills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", projectId] });
      toast({ title: "Skill deleted" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      const res = await apiRequest("POST", `/api/skills/${projectId}/upload`, { filename, content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", projectId] });
      toast({ title: "Skill imported from file" });
    },
    onError: (err: any) => toast({ title: "Failed to import", description: err.message, variant: "destructive" }),
  });

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith(".md")) {
      toast({ title: "Only .md files are supported", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      uploadMutation.mutate({ filename: file.name, content });
    };
    reader.readAsText(file);
  }, [uploadMutation, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const skills = skillsQuery.data || [];
  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      ref={dropRef}
      className={`flex flex-col h-full ${isDragging ? "ring-2 ring-[#7C65CB] ring-inset" : ""}`}
      data-testid="skills-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-3 h-9 border-b border-[var(--ide-border)] shrink-0">
        <span className="text-[10px] font-bold text-[var(--ide-text-secondary)] uppercase tracking-widest flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-[#7C65CB]" /> Skills
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
            onClick={() => fileInputRef.current?.click()}
            title="Import .md file"
            data-testid="button-import-skill"
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[#0CCE6B] hover:bg-[var(--ide-surface)]"
            onClick={() => setCreating(!creating)}
            data-testid="button-new-skill"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-5 h-5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] hover:bg-[var(--ide-surface)]"
            onClick={onClose}
            data-testid="button-close-skills"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = "";
        }}
        data-testid="input-file-upload"
      />

      {skills.length > 0 && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ide-text-muted)]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search skills..."
              className="bg-[var(--ide-bg)] border-[var(--ide-border)] h-7 text-[11px] text-[var(--ide-text)] rounded pl-7"
              data-testid="input-search-skills"
            />
          </div>
        </div>
      )}

      {creating && (
        <div className="px-3 py-2 border-b border-[var(--ide-border)] space-y-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Skill name..."
            className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
            data-testid="input-skill-name"
          />
          <Input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short description..."
            className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
            data-testid="input-skill-description"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={6}
            className="w-full text-[10px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md p-2 resize-none"
            placeholder="Skill content (markdown)..."
            data-testid="textarea-skill-content"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-7 px-3 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded-md font-semibold"
              onClick={() => createMutation.mutate({ name: newName, description: newDescription, content: newContent })}
              disabled={!newName.trim() || createMutation.isPending}
              data-testid="button-create-skill"
            >
              {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-[10px]"
              onClick={() => setCreating(false)}
              data-testid="button-cancel-skill"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {skillsQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[var(--ide-text-muted)] animate-spin" />
          </div>
        )}

        {skills.length === 0 && !skillsQuery.isLoading && !creating && (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4" data-testid="skills-empty-state">
            <div className="w-12 h-12 rounded-xl bg-[var(--ide-bg)] border border-[var(--ide-border)] flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-[var(--ide-text-muted)] opacity-40" />
            </div>
            <p className="text-xs text-[var(--ide-text-secondary)] font-medium">No Skills Yet</p>
            <p className="text-[10px] text-[var(--ide-text-muted)] mt-1 max-w-[200px]">
              Skills teach the AI Agent reusable patterns and conventions for your project
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="h-7 px-3 text-[10px] bg-[#7C65CB] hover:bg-[#7C65CB]/80 text-white rounded-md font-semibold gap-1"
                onClick={() => setCreating(true)}
                data-testid="button-create-first-skill"
              >
                <Sparkles className="w-3 h-3" /> Create your first skill
              </Button>
            </div>
            <p className="text-[9px] text-[var(--ide-text-muted)] mt-3 opacity-60">
              Or drag & drop a .md file here to import
            </p>
          </div>
        )}

        {isDragging && (
          <div className="absolute inset-0 bg-[#7C65CB]/10 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[var(--ide-surface)] border-2 border-dashed border-[#7C65CB]">
              <Upload className="w-6 h-6 text-[#7C65CB]" />
              <span className="text-xs text-[#7C65CB] font-medium">Drop .md file to import as skill</span>
            </div>
          </div>
        )}

        {filtered.map((skill) => (
          <div key={skill.id} className="border-b border-[var(--ide-border)]/50" data-testid={`skill-item-${skill.id}`}>
            <div
              className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--ide-surface)]/30 cursor-pointer"
              onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
            >
              {expandedId === skill.id ? (
                <ChevronDown className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[var(--ide-text-muted)] shrink-0" />
              )}
              <FileText className="w-3.5 h-3.5 text-[#7C65CB] shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-[var(--ide-text)] font-medium truncate block">{skill.name}</span>
                {skill.description && (
                  <span className="text-[9px] text-[var(--ide-text-muted)] truncate block">{skill.description}</span>
                )}
                <span className="text-[8px] text-[var(--ide-text-muted)] truncate block opacity-60">
                  {skill.content ? skill.content.slice(0, 80).replace(/\n/g, " ") + (skill.content.length > 80 ? "..." : "") : "(empty)"}
                  {" · "}{new Date(skill.createdAt).toLocaleDateString()}
                </span>
              </div>
              <Switch
                checked={skill.isActive}
                onCheckedChange={(checked) => toggleMutation.mutate({ id: skill.id, isActive: checked })}
                className="scale-75"
                onClick={(e) => e.stopPropagation()}
                data-testid={`switch-skill-${skill.id}`}
              />
            </div>

            {expandedId === skill.id && (
              <div className="px-3 pb-2 space-y-2">
                {editingId === skill.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Skill name..."
                      className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
                      data-testid={`input-edit-name-${skill.id}`}
                    />
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description..."
                      className="h-7 text-xs bg-[var(--ide-bg)] border-[var(--ide-border)] text-[var(--ide-text)]"
                      data-testid={`input-edit-description-${skill.id}`}
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={8}
                      className="w-full text-[10px] font-mono bg-[var(--ide-bg)] border border-[var(--ide-border)] text-[var(--ide-text)] rounded-md p-2 resize-none"
                      data-testid={`textarea-edit-content-${skill.id}`}
                    />
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 px-2 text-[9px] bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black rounded"
                        onClick={() => updateMutation.mutate({
                          id: skill.id,
                          data: { name: editName, description: editDescription, content: editContent },
                        })}
                        disabled={updateMutation.isPending}
                        data-testid={`button-save-skill-${skill.id}`}
                      >
                        {updateMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[9px]"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="px-2 py-1.5 bg-[var(--ide-bg)] rounded-md border border-[var(--ide-border)] max-h-48 overflow-y-auto" data-testid={`text-skill-content-${skill.id}`}>
                    {skill.content ? (
                      <div className="prose prose-xs prose-invert max-w-none text-[9px] text-[var(--ide-text-secondary)] [&_h1]:text-[11px] [&_h1]:font-bold [&_h1]:text-[var(--ide-text)] [&_h2]:text-[10px] [&_h2]:font-bold [&_h2]:text-[var(--ide-text)] [&_h3]:text-[9px] [&_h3]:font-semibold [&_h3]:text-[var(--ide-text)] [&_code]:text-[8px] [&_code]:bg-[var(--ide-surface)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-[8px] [&_pre]:bg-[var(--ide-surface)] [&_pre]:p-1.5 [&_pre]:rounded [&_pre]:overflow-x-auto [&_ul]:list-disc [&_ul]:pl-3 [&_ol]:list-decimal [&_ol]:pl-3 [&_li]:text-[9px] [&_p]:text-[9px] [&_a]:text-[#0079F2] [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--ide-border)] [&_blockquote]:pl-2 [&_blockquote]:italic">
                        <ReactMarkdown>{skill.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-[9px] text-[var(--ide-text-muted)]">(no content)</span>
                    )}
                  </div>
                )}

                {editingId !== skill.id && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] gap-1"
                      onClick={() => {
                        setEditingId(skill.id);
                        setEditName(skill.name);
                        setEditDescription(skill.description);
                        setEditContent(skill.content);
                      }}
                      data-testid={`button-edit-skill-${skill.id}`}
                    >
                      <Pencil className="w-2.5 h-2.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[9px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => deleteMutation.mutate(skill.id)}
                      data-testid={`button-delete-skill-${skill.id}`}
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                )}

                <div className="text-[8px] text-[var(--ide-text-muted)]" data-testid={`text-skill-date-${skill.id}`}>
                  Created {new Date(skill.createdAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
