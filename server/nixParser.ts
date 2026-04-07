export function parseReplitNix(content: string): Record<string, any> {
  try {
    const deps: string[] = [];
    const depMatch = content.match(/deps\s*=\s*\[([\s\S]*?)\]/);
    if (depMatch) {
      const depsStr = depMatch[1];
      const pkgMatches = depsStr.matchAll(/pkgs\.(\w[\w.-]*)/g);
      for (const m of pkgMatches) {
        deps.push(m[1]);
      }
    }
    return { deps };
  } catch {
    return { deps: [] };
  }
}

export function serializeReplitNix(config: Record<string, any>): string {
  const deps = (config.deps || []) as string[];
  return `{ pkgs }: {
  deps = [
${deps.map((d: string) => `    pkgs.${d}`).join("\n")}
  ];
}`;
}
