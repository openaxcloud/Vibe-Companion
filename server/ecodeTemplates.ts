export function generateEcodeContent(projectName: string, context?: any): string {
  return `# ${projectName}\n\nE-Code project configuration.\n`;
}

export function getEcodeFilename(projectName: string): string {
  return `${projectName.toLowerCase().replace(/\s+/g, "-")}.ecode.md`;
}

export function buildProjectStructureTree(files: Array<{ name: string; path?: string }>): string {
  return files.map((f) => `├── ${f.path || f.name}`).join("\n");
}

export function detectDependencies(files: Array<{ name: string; content?: string }>): string[] {
  const deps: string[] = [];
  for (const f of files) {
    if (f.name === "package.json" && f.content) {
      try {
        const pkg = JSON.parse(f.content);
        deps.push(...Object.keys(pkg.dependencies || {}));
      } catch {}
    }
  }
  return deps;
}

export function detectDependenciesFromPackageJson(packageJson: any): string[] {
  return Object.keys(packageJson?.dependencies || {});
}

export function parseUserPreferences(prefs: any): Record<string, any> {
  return prefs || {};
}

export function parseProjectContext(context: any): Record<string, any> {
  return context || {};
}

export function updateEcodeStructureSection(content: string, structure: string): string {
  return content.replace(/## Structure[\s\S]*?(?=##|$)/, `## Structure\n\n${structure}\n\n`);
}

export function buildEcodePromptContext(projectName: string, files: any[], prefs: any): string {
  return `Project: ${projectName}\nFiles: ${files.length}\n`;
}

export function shouldAutoUpdate(lastUpdated?: Date): boolean {
  if (!lastUpdated) return true;
  const hoursSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  return hoursSince > 1;
}
