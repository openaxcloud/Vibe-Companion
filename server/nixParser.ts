export interface NixConfig {
  deps: string[];
}

export function parseReplitNix(content: string): NixConfig {
  const deps: string[] = [];

  const depsMatch = content.match(/deps\s*=\s*(?:with\s+pkgs;\s*)?\[([^\]]*)\]/s);
  if (depsMatch) {
    const depsBlock = depsMatch[1];
    const pkgMatches = depsBlock.match(/[a-zA-Z_][a-zA-Z0-9_.-]*/g);
    if (pkgMatches) {
      for (const pkg of pkgMatches) {
        if (pkg !== "with" && pkg !== "pkgs" && pkg !== "import" && pkg !== "fetchTarball") {
          deps.push(pkg);
        }
      }
    }
  }

  return { deps };
}

export function serializeReplitNix(deps: string[]): string {
  const depsStr = deps.length > 0 ? deps.map(d => `    pkgs.${d}`).join("\n") : "";
  return `{ pkgs }: {
  deps = [
${depsStr}
  ];
}
`;
}

export async function getProjectNixDeps(projectId: string, files: { filename: string; content: string | null }[]): Promise<string[]> {
  const nixFile = files.find(f => f.filename === "replit.nix");
  if (!nixFile || !nixFile.content) return [];
  try {
    return parseReplitNix(nixFile.content).deps;
  } catch {
    return [];
  }
}
