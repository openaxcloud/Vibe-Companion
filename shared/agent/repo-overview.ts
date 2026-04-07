/**
 * Repository Overview Types
 * Shared types for repository structure analysis and context
 */

export interface RepoOverview {
  name: string;
  description: string;
  structure: RepoStructure;
  languages: LanguageInfo[];
  frameworks: FrameworkInfo[];
  dependencies: DependenciesInfo;
  entryPoints: EntryPoints;
  metrics: RepoMetrics;
}

export interface RepoStructure {
  directories: DirectoryInfo[];
  mainFiles: FileInfo[];
  configFiles: ConfigFileInfo[];
  totalFiles: number;
  totalDirectories: number;
}

export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  purpose?: string; // 'components', 'api', 'utils', etc.
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  language: string;
  linesOfCode?: number;
}

export interface ConfigFileInfo extends FileInfo {
  type: 'build' | 'package' | 'database' | 'typescript' | 'env' | 'other';
  framework?: string;
}

export interface LanguageInfo {
  name: string;
  fileCount: number;
  linesOfCode: number;
  percentage: number; // % of total codebase
}

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'build';
  configFile: string;
}

export interface DependenciesInfo {
  frontend: DependencyGroup;
  backend: DependencyGroup;
  dev: DependencyGroup;
  total: number;
}

export interface DependencyGroup {
  packages: PackageInfo[];
  count: number;
}

export interface PackageInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
}

export interface EntryPoints {
  frontend?: EntryPoint;
  backend?: EntryPoint;
  scripts?: Record<string, string>;
}

export interface EntryPoint {
  file: string;
  command?: string;
  port?: number;
}

export interface RepoMetrics {
  totalLinesOfCode: number;
  codeComplexity: 'low' | 'medium' | 'high';
  estimatedBuildTime?: number; // seconds
  hasTests: boolean;
  testCoverage?: number; // percentage
}

/**
 * Lightweight version for quick context
 */
export interface RepoContext {
  name: string;
  mainLanguage: string;
  framework: string;
  type: 'frontend' | 'backend' | 'fullstack';
  hasDatabase: boolean;
  hasAuth: boolean;
}

/**
 * Result of repo analysis operation
 */
export interface RepoAnalysisResult {
  overview: RepoOverview;
  context: RepoContext;
  recommendations: string[];
  warnings: string[];
  timestamp: number;
}
