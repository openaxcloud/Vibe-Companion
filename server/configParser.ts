export interface ReplitConfig {
  run?: string;
  entrypoint?: string;
  language?: string;
  modules?: string[];
  [key: string]: any;
}

export function getProjectConfig(projectId: string): ReplitConfig {
  return { run: "npm run dev", language: "nodejs" };
}

export function parseReplitConfig(content: string): ReplitConfig {
  try {
    const config: ReplitConfig = {};
    const lines = content.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\w+)\s*=\s*"?([^"]*)"?\s*$/);
      if (match) {
        config[match[1]] = match[2];
      }
    }
    return config;
  } catch {
    return {};
  }
}

export function serializeReplitConfig(config: ReplitConfig): string {
  return Object.entries(config)
    .filter(([_, v]) => v !== undefined && typeof v !== "object")
    .map(([k, v]) => `${k} = "${v}"`)
    .join("\n");
}

export function getEnvironmentMetadata(): Record<string, any> {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    isReplit: !!process.env.REPL_ID,
  };
}
