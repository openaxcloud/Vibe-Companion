import { parse as parseToml } from "smol-toml";
import { storage } from "./storage";

export interface PortMapping {
  localPort: number;
  externalPort: number;
}

export interface PackagerConfig {
  guessImports?: boolean;
  packageSearch?: boolean;
  afterInstall?: string;
  ignoredPaths?: string[];
  ignoredPackages?: string[];
  enabledForHosting?: boolean;
  language?: string;
}

export interface DeploymentConfig {
  run?: string | string[];
  build?: string;
  ignorePorts?: number[];
  deploymentTarget?: string;
}

export interface UnitTestConfig {
  language?: string;
}

export interface GitHubImportConfig {
  requiredFiles?: string[];
}

export interface NixConfig {
  channel?: string;
}

export interface RunEnv {
  [key: string]: string;
}

export interface ReplitConfig {
  entrypoint?: string;
  run?: string | string[];
  build?: string | string[];
  compile?: string | string[];
  onBoot?: string;
  hidden?: string[];
  audio?: boolean;
  language?: string;
  modules?: string[];
  nix?: NixConfig;
  unitTest?: UnitTestConfig;
  packager?: PackagerConfig;
  deployment?: DeploymentConfig;
  ports?: PortMapping[];
  runEnv?: RunEnv;
  gitHubImport?: GitHubImportConfig;
}

export function parseReplitConfig(content: string): ReplitConfig {
  const raw = parseToml(content) as Record<string, any>;
  const config: ReplitConfig = {};

  if (typeof raw.entrypoint === "string") config.entrypoint = raw.entrypoint;
  if (typeof raw.run === "string") {
    config.run = raw.run;
  } else if (Array.isArray(raw.run)) {
    config.run = raw.run.map(String);
  }
  if (typeof raw.build === "string") {
    config.build = raw.build;
  } else if (Array.isArray(raw.build)) {
    config.build = raw.build.map(String);
  }
  if (typeof raw.compile === "string") {
    config.compile = raw.compile;
  } else if (Array.isArray(raw.compile)) {
    config.compile = raw.compile.map(String);
  }
  if (typeof raw.onBoot === "string") config.onBoot = raw.onBoot;
  if (Array.isArray(raw.hidden)) config.hidden = raw.hidden.map(String);
  if (typeof raw.audio === "boolean") config.audio = raw.audio;
  if (typeof raw.language === "string") config.language = raw.language;
  if (Array.isArray(raw.modules)) config.modules = raw.modules.map(String);

  if (raw.nix && typeof raw.nix === "object") {
    config.nix = {};
    if (typeof raw.nix.channel === "string") config.nix.channel = raw.nix.channel;
  }

  if (raw.unitTest && typeof raw.unitTest === "object") {
    config.unitTest = {};
    if (typeof raw.unitTest.language === "string") config.unitTest.language = raw.unitTest.language;
  }

  if (raw.packager && typeof raw.packager === "object") {
    config.packager = {};
    if (typeof raw.packager.guessImports === "boolean") config.packager.guessImports = raw.packager.guessImports;
    if (typeof raw.packager.packageSearch === "boolean") config.packager.packageSearch = raw.packager.packageSearch;
    if (typeof raw.packager.afterInstall === "string") config.packager.afterInstall = raw.packager.afterInstall;
    if (Array.isArray(raw.packager.ignoredPaths)) config.packager.ignoredPaths = raw.packager.ignoredPaths.map(String);
    if (Array.isArray(raw.packager.ignoredPackages)) config.packager.ignoredPackages = raw.packager.ignoredPackages.map(String);
    if (typeof raw.packager.enabledForHosting === "boolean") config.packager.enabledForHosting = raw.packager.enabledForHosting;
    if (typeof raw.packager.language === "string") config.packager.language = raw.packager.language;
  }

  if (raw.deployment && typeof raw.deployment === "object") {
    config.deployment = {};
    if (typeof raw.deployment.run === "string") {
      config.deployment.run = raw.deployment.run;
    } else if (Array.isArray(raw.deployment.run)) {
      config.deployment.run = raw.deployment.run.map(String);
    }
    if (typeof raw.deployment.build === "string") config.deployment.build = raw.deployment.build;
    if (Array.isArray(raw.deployment.ignorePorts)) config.deployment.ignorePorts = raw.deployment.ignorePorts.map(Number);
    if (typeof raw.deployment.deploymentTarget === "string") config.deployment.deploymentTarget = raw.deployment.deploymentTarget;
  }

  if (Array.isArray(raw.ports)) {
    config.ports = raw.ports
      .filter((p: unknown): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p: Record<string, unknown>) => ({
        localPort: Number(p.localPort || p.local_port || 0),
        externalPort: Number(p.externalPort || p.external_port || 0),
      }))
      .filter((p: PortMapping) => p.localPort > 0);
  }

  if (raw.run && typeof raw.run === "object" && !Array.isArray(raw.run)) {
    if (raw.run.command) {
      if (typeof raw.run.command === "string") {
        config.run = raw.run.command;
      } else if (Array.isArray(raw.run.command)) {
        config.run = raw.run.command.map(String);
      }
    }
    if (raw.run.env && typeof raw.run.env === "object") {
      config.runEnv = {};
      for (const [k, v] of Object.entries(raw.run.env)) {
        config.runEnv[k] = String(v);
      }
    }
  }

  if (raw.gitHubImport && typeof raw.gitHubImport === "object") {
    config.gitHubImport = {};
    if (Array.isArray(raw.gitHubImport.requiredFiles)) {
      config.gitHubImport.requiredFiles = raw.gitHubImport.requiredFiles.map(String);
    }
  }

  return config;
}

export function serializeReplitConfig(config: ReplitConfig): string {
  const lines: string[] = [];

  if (config.entrypoint) lines.push(`entrypoint = "${config.entrypoint}"`);

  const hasRunEnv = config.runEnv && Object.keys(config.runEnv).length > 0;
  if (config.run && hasRunEnv) {
    lines.push("");
    lines.push("[run]");
    if (typeof config.run === "string") {
      lines.push(`command = "${config.run}"`);
    } else {
      lines.push(`command = [${config.run.map(s => `"${s}"`).join(", ")}]`);
    }
    lines.push("");
    lines.push("[run.env]");
    for (const [k, v] of Object.entries(config.runEnv!)) {
      lines.push(`${k} = "${v}"`);
    }
  } else if (config.run) {
    if (typeof config.run === "string") {
      lines.push(`run = "${config.run}"`);
    } else {
      lines.push(`run = [${config.run.map(s => `"${s}"`).join(", ")}]`);
    }
  }

  if (config.build) {
    if (typeof config.build === "string") {
      lines.push(`build = "${config.build}"`);
    } else {
      lines.push(`build = [${config.build.map(s => `"${s}"`).join(", ")}]`);
    }
  }
  if (config.compile) {
    if (typeof config.compile === "string") {
      lines.push(`compile = "${config.compile}"`);
    } else {
      lines.push(`compile = [${config.compile.map(s => `"${s}"`).join(", ")}]`);
    }
  }
  if (config.onBoot) lines.push(`onBoot = "${config.onBoot}"`);
  if (config.hidden && config.hidden.length > 0) {
    lines.push(`hidden = [${config.hidden.map(s => `"${s}"`).join(", ")}]`);
  }
  if (config.audio !== undefined) lines.push(`audio = ${config.audio}`);
  if (config.language) lines.push(`language = "${config.language}"`);
  if (config.modules && config.modules.length > 0) {
    lines.push(`modules = [${config.modules.map(s => `"${s}"`).join(", ")}]`);
  }

  if (config.nix) {
    lines.push("");
    lines.push("[nix]");
    if (config.nix.channel) lines.push(`channel = "${config.nix.channel}"`);
  }

  if (config.unitTest) {
    lines.push("");
    lines.push("[unitTest]");
    if (config.unitTest.language) lines.push(`language = "${config.unitTest.language}"`);
  }

  if (config.packager) {
    lines.push("");
    lines.push("[packager]");
    if (config.packager.guessImports !== undefined) lines.push(`guessImports = ${config.packager.guessImports}`);
    if (config.packager.packageSearch !== undefined) lines.push(`packageSearch = ${config.packager.packageSearch}`);
    if (config.packager.afterInstall) lines.push(`afterInstall = "${config.packager.afterInstall}"`);
    if (config.packager.language) lines.push(`language = "${config.packager.language}"`);
    if (config.packager.enabledForHosting !== undefined) lines.push(`enabledForHosting = ${config.packager.enabledForHosting}`);
    if (config.packager.ignoredPaths && config.packager.ignoredPaths.length > 0) {
      lines.push(`ignoredPaths = [${config.packager.ignoredPaths.map(s => `"${s}"`).join(", ")}]`);
    }
    if (config.packager.ignoredPackages && config.packager.ignoredPackages.length > 0) {
      lines.push(`ignoredPackages = [${config.packager.ignoredPackages.map(s => `"${s}"`).join(", ")}]`);
    }
  }

  if (config.deployment) {
    lines.push("");
    lines.push("[deployment]");
    if (config.deployment.run) {
      if (typeof config.deployment.run === "string") {
        lines.push(`run = "${config.deployment.run}"`);
      } else {
        lines.push(`run = [${config.deployment.run.map(s => `"${s}"`).join(", ")}]`);
      }
    }
    if (config.deployment.build) lines.push(`build = "${config.deployment.build}"`);
    if (config.deployment.deploymentTarget) lines.push(`deploymentTarget = "${config.deployment.deploymentTarget}"`);
    if (config.deployment.ignorePorts && config.deployment.ignorePorts.length > 0) {
      lines.push(`ignorePorts = [${config.deployment.ignorePorts.join(", ")}]`);
    }
  }

  if (config.ports && config.ports.length > 0) {
    for (const port of config.ports) {
      lines.push("");
      lines.push("[[ports]]");
      lines.push(`localPort = ${port.localPort}`);
      if (port.externalPort !== undefined) {
        lines.push(`externalPort = ${port.externalPort}`);
      }
    }
  }

  if (!config.run && config.runEnv && Object.keys(config.runEnv).length > 0) {
    lines.push("");
    lines.push("[run]");
    lines.push("");
    lines.push("[run.env]");
    for (const [k, v] of Object.entries(config.runEnv)) {
      lines.push(`${k} = "${v}"`);
    }
  }

  if (config.gitHubImport) {
    lines.push("");
    lines.push("[gitHubImport]");
    if (config.gitHubImport.requiredFiles && config.gitHubImport.requiredFiles.length > 0) {
      lines.push(`requiredFiles = [${config.gitHubImport.requiredFiles.map(s => `"${s}"`).join(", ")}]`);
    }
  }

  return lines.join("\n") + "\n";
}

export async function getProjectConfig(projectId: string): Promise<ReplitConfig> {
  const files = await storage.getFiles(projectId);
  const replitFile = files.find(f => f.filename === ".replit");
  if (!replitFile || !replitFile.content) return {};
  try {
    return parseReplitConfig(replitFile.content);
  } catch {
    return {};
  }
}

export function getEnvironmentMetadata(project: { id: string; name: string; language: string; userId: string }): Record<string, string> {
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    REPL_OWNER: project.userId,
    REPL_ID: project.id,
    REPL_SLUG: slug,
    REPL_LANGUAGE: project.language,
    REPL_IMAGE: "nix",
    HOME: process.env.HOME || "/home/runner",
    LANG: "en_US.UTF-8",
    PRYBAR_FILE: "",
    REPLIT_DEV_DOMAIN: `${project.id}.repl.co`,
  };
}
