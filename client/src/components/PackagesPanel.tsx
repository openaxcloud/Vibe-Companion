import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Package, Plus, RefreshCw, X } from "lucide-react";

interface PackagesPanelProps {
  projectId: string;
  onClose: () => void;
}

export default function PackagesPanel({ projectId, onClose }: PackagesPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPackageName, setNewPackageName] = useState("");

  const packagesQuery = useQuery<{ packages: { name: string; version: string; dev?: boolean }[]; packageManager: string; language: string }>({
    queryKey: ["/api/projects", projectId, "packages"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/packages`, { credentials: "include" });
      if (!res.ok) return { packages: [], packageManager: "none", language: "javascript" };
      return res.json();
    },
  });

  const addPackageMutation = useMutation({
    mutationFn: async ({ name, dev }: { name: string; dev?: boolean }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/packages/add`, { name, dev });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({ title: "Package added", description: data.command ? `Run: ${data.command}` : undefined });
      setNewPackageName("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const removePackageMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/packages/remove`, { name });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "packages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "files"] });
      toast({ title: "Package removed", description: data.command ? `Run: ${data.command}` : undefined });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full" data-testid="packages-panel">
      <div className="flex items-center justify-between px-3 h-9 border-b border-[#2B3245] shrink-0">
        <span className="text-[10px] font-bold text-[#9DA2B0] uppercase tracking-widest flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-[#0CCE6B]" /> Packages
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[#676D7E] hover:text-[#F5F9FC]" onClick={() => packagesQuery.refetch()} data-testid="button-refresh-packages">
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 text-[#676D7E] hover:text-[#F5F9FC]" onClick={onClose} data-testid="button-close-packages">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="px-3 py-2 border-b border-[#2B3245]">
        <form onSubmit={(e) => { e.preventDefault(); if (newPackageName.trim()) addPackageMutation.mutate({ name: newPackageName.trim() }); }} className="flex gap-1.5">
          <Input
            value={newPackageName}
            onChange={(e) => setNewPackageName(e.target.value)}
            placeholder="Add package..."
            className="flex-1 h-7 text-xs bg-[#0E1525] border-[#2B3245] text-[#F5F9FC] rounded-md placeholder:text-[#676D7E]"
            data-testid="input-add-package"
          />
          <Button type="submit" size="sm" disabled={!newPackageName.trim() || addPackageMutation.isPending}
            className="h-7 px-2 bg-[#0CCE6B] hover:bg-[#0CCE6B]/80 text-black text-[10px] rounded-md" data-testid="button-add-package">
            {addPackageMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          </Button>
        </form>
        {packagesQuery.data && (
          <div className="mt-1.5 text-[9px] text-[#676D7E]">
            {packagesQuery.data.packageManager === "npm" ? "npm" : packagesQuery.data.packageManager === "pip" ? "pip" : "No package manager detected"} · {packagesQuery.data.packages.length} packages
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {packagesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[#676D7E] animate-spin" /></div>
        ) : (packagesQuery.data?.packages.length || 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="w-8 h-8 text-[#2B3245] mb-2" />
            <p className="text-xs text-[#676D7E]">No packages found</p>
            <p className="text-[10px] text-[#676D7E] mt-1">Add a package above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2B3245]/50">
            {packagesQuery.data!.packages.map((pkg, i) => (
              <div key={`${pkg.name}-${i}`} className="flex items-center justify-between px-3 py-2 hover:bg-[#2B3245]/30 group" data-testid={`package-item-${pkg.name}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[#F5F9FC] font-medium truncate">{pkg.name}</span>
                    {pkg.dev && <span className="text-[8px] px-1 py-0.5 rounded bg-[#2B3245] text-[#9DA2B0]">dev</span>}
                  </div>
                  <span className="text-[10px] text-[#676D7E]">{pkg.version}</span>
                </div>
                <Button variant="ghost" size="icon"
                  className="w-5 h-5 text-[#676D7E] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePackageMutation.mutate(pkg.name)}
                  disabled={removePackageMutation.isPending}
                  data-testid={`button-remove-package-${pkg.name}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
