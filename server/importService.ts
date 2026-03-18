import * as github from "./github";
import { storage } from "./storage";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require("adm-zip");

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".webp",
  ".mp3", ".mp4", ".wav", ".ogg", ".webm", ".avi",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".exe", ".dll", ".so", ".dylib", ".o",
  ".pyc", ".pyo", ".class", ".jar",
  ".lock",
]);

const LANGUAGE_MAP: Record<string, string> = {
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rb": "ruby",
  ".java": "java",
  ".c": "c", ".h": "c",
  ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp",
  ".rs": "rust",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin", ".kts": "kotlin",
  ".cs": "csharp",
  ".html": "html", ".htm": "html",
  ".css": "css", ".scss": "css", ".sass": "css", ".less": "css",
  ".vue": "javascript",
  ".svelte": "javascript",
  ".dart": "dart",
  ".r": "r", ".R": "r",
  ".lua": "lua",
  ".sh": "bash", ".bash": "bash",
  ".sql": "sql",
  ".json": "javascript",
  ".yaml": "javascript", ".yml": "javascript",
  ".md": "markdown", ".mdx": "markdown",
};

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot).toLowerCase();
}

function isBinaryFile(path: string): boolean {
  return BINARY_EXTENSIONS.has(getExtension(path));
}

export function detectLanguageFromFiles(filenames: string[]): string {
  const counts: Record<string, number> = {};
  for (const f of filenames) {
    const ext = getExtension(f);
    const lang = LANGUAGE_MAP[ext];
    if (lang && lang !== "markdown" && lang !== "json") {
      counts[lang] = (counts[lang] || 0) + 1;
    }
  }
  if (Object.keys(counts).length === 0) return "javascript";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function detectLanguageFromGitHub(repoLanguage: string | null, filenames: string[]): string {
  const githubLangMap: Record<string, string> = {
    "Python": "python", "TypeScript": "typescript", "JavaScript": "javascript",
    "Go": "go", "Ruby": "ruby", "Java": "java", "C": "c", "C++": "cpp",
    "Rust": "rust", "PHP": "php", "Swift": "swift", "Kotlin": "kotlin",
    "C#": "csharp", "Dart": "dart", "R": "r", "Lua": "lua", "Shell": "bash",
    "HTML": "html", "CSS": "css", "Vue": "javascript", "Svelte": "javascript",
  };
  if (repoLanguage && githubLangMap[repoLanguage]) {
    return githubLangMap[repoLanguage];
  }
  return detectLanguageFromFiles(filenames);
}

export interface ImportResult {
  project: { id: string; name: string; language: string };
  fileCount: number;
  warnings: string[];
  requiredSecrets: string[];
}

export interface ValidationResult {
  valid: boolean;
  compatible: boolean;
  reasons: string[];
  detectedLanguage?: string;
  fileCount?: number;
}

const MAX_FILE_SIZE = 500000;
const MAX_FILES_DEFAULT = 5000;
const MAX_ZIP_FILES = 500;
const MAX_ZIP_SIZE = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024;
const MAX_ENTRY_SIZE = 10 * 1024 * 1024;

export interface ImportJob {
  id: string;
  userId: string;
  status: "pending" | "validating" | "importing" | "processing" | "complete" | "error";
  progress: number;
  totalFiles: number;
  importedFiles: number;
  currentFile: string;
  message: string;
  result?: ImportResult;
  error?: string;
}

const importJobs = new Map<string, ImportJob>();

function createJob(userId: string): ImportJob {
  const id = `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: ImportJob = {
    id,
    userId,
    status: "pending",
    progress: 0,
    totalFiles: 0,
    importedFiles: 0,
    currentFile: "",
    message: "Initializing...",
  };
  importJobs.set(id, job);
  return job;
}

function updateJob(job: ImportJob, updates: Partial<ImportJob>) {
  Object.assign(job, updates);
  if (job.totalFiles > 0) {
    job.progress = Math.round((job.importedFiles / job.totalFiles) * 100);
  }
}

export function getImportJob(jobId: string, userId: string): ImportJob | undefined {
  const job = importJobs.get(jobId);
  if (job && job.userId !== userId) return undefined;
  return job;
}

function cleanupOldJobs() {
  const now = Date.now();
  for (const [id] of importJobs) {
    const ts = parseInt(id.split("_")[1] || "0", 10);
    if (now - ts > 30 * 60 * 1000) {
      importJobs.delete(id);
    }
  }
}

export function startAsyncImport(
  source: string,
  userId: string,
  params: Record<string, string | undefined>,
): string {
  cleanupOldJobs();
  const job = createJob(userId);

  const runImport = async () => {
    try {
      let result: ImportResult & { jobId: string };
      switch (source) {
        case "github":
          result = await importFromGitHub(userId, params.owner!, params.repo!, params.name, params.branch, MAX_FILES_DEFAULT, job);
          break;
        case "figma":
          result = await importFromFigma(userId, params.url!, params.name || "figma-import", (params.provider || "openai") as "openai" | "anthropic" | "gemini", params.designContext, job);
          break;
        case "vercel":
          result = await importFromVercel(userId, params.url!, params.name, job) as ImportResult & { jobId: string };
          break;
        case "bolt":
          result = await importFromBolt(userId, params.url!, params.name, job);
          break;
        case "lovable":
          result = await importFromLovable(userId, params.url!, params.name, job);
          break;
        default:
          throw new Error(`Unknown import source: ${source}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      updateJob(job, { status: "error", error: message });
    }
  };

  runImport();
  return job.id;
}

export async function importFromGitHub(
  userId: string,
  owner: string,
  repo: string,
  projectName?: string,
  branch?: string,
  maxFiles: number = MAX_FILES_DEFAULT,
  existingJob?: ImportJob,
): Promise<ImportResult & { jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  const projectCheck = await storage.checkProjectLimit(userId);
  if (!projectCheck.allowed) {
    updateJob(job, { status: "error", error: "Project limit reached. Upgrade your plan for more projects." });
    throw new Error("Project limit reached. Upgrade your plan for more projects.");
  }

  updateJob(job, { status: "validating", message: "Fetching repository information..." });

  const repoInfo = await github.getRepo(owner, repo);
  const defaultBranch = branch || repoInfo.default_branch || "main";

  updateJob(job, { message: "Fetching repository file tree..." });
  const treeResult = await github.getRepoTreePaginated(owner, repo, defaultBranch, maxFiles);
  if (treeResult.tree.length === 0) {
    updateJob(job, { status: "error", error: "Repository is empty or inaccessible." });
    throw new Error("Repository is empty or inaccessible.");
  }

  const textFiles = treeResult.tree.filter((item: { path: string }) => !isBinaryFile(item.path));
  const filenames = treeResult.tree.map((item: { path: string }) => item.path);
  const lang = detectLanguageFromGitHub(repoInfo.language, filenames);

  const project = await storage.createProject(userId, {
    name: (projectName || repo).slice(0, 50),
    language: lang,
    visibility: "private",
    outputType: "web",
    projectType: "web-app",
  });

  await storage.updateProject(project.id, { githubRepo: `${owner}/${repo}` });

  const filesToImport = textFiles;
  let importedCount = 0;
  const warnings: string[] = [];

  if (treeResult.truncated && treeResult.tree.length < maxFiles) {
    warnings.push(`Repository tree was very large. ${treeResult.tree.length} files were discovered; some deep paths may be missing.`);
  }

  updateJob(job, {
    status: "importing",
    totalFiles: filesToImport.length,
    message: `Importing ${filesToImport.length} files...`,
  });

  const BATCH_SIZE = 10;
  for (let i = 0; i < filesToImport.length; i += BATCH_SIZE) {
    const batch = filesToImport.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (item: { path: string }) => {
        const content = await github.getFileContent(owner, repo, item.path);
        await storage.createFile(project.id, {
          filename: item.path,
          content: content.slice(0, MAX_FILE_SIZE),
        });
        return item.path;
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        importedCount++;
      } else {
        const batchItem = batch[results.indexOf(r)];
        warnings.push(`Failed to import: ${batchItem?.path || "unknown"}`);
      }
    }

    updateJob(job, {
      importedFiles: importedCount,
      currentFile: batch[batch.length - 1]?.path || "",
      message: `Imported ${importedCount}/${filesToImport.length} files...`,
    });
  }

  if (importedCount === 0) {
    try { await storage.deleteProject(project.id, userId); } catch { /* cleanup failure is non-critical */ }
    updateJob(job, { status: "error", error: "No files could be imported from this repository." });
    throw new Error("No files could be imported from this repository.");
  }

  const result: ImportResult = {
    project: { id: project.id, name: project.name, language: project.language },
    fileCount: importedCount,
    warnings,
    requiredSecrets: [],
  };

  updateJob(job, { status: "complete", message: "Import complete", result });

  return { ...result, jobId: job.id };
}

export function startAsyncZipImport(
  userId: string,
  buffer: Buffer,
  projectName: string,
): string {
  cleanupOldJobs();
  const job = createJob(userId);
  const runImport = async () => {
    try {
      await importFromZip(userId, buffer, projectName, job);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "ZIP import failed";
      updateJob(job, { status: "error", error: message });
    }
  };
  runImport();
  return job.id;
}

export async function importFromZip(
  userId: string,
  buffer: Buffer,
  projectName: string,
  existingJob?: ImportJob,
): Promise<ImportResult & { jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  const projectCheck = await storage.checkProjectLimit(userId);
  if (!projectCheck.allowed) {
    updateJob(job, { status: "error", error: "Project limit reached." });
    throw new Error("Project limit reached. Upgrade your plan for more projects.");
  }

  updateJob(job, { status: "validating", message: "Validating ZIP file..." });

  if (buffer.length > MAX_ZIP_SIZE) {
    updateJob(job, { status: "error", error: "ZIP file too large." });
    throw new Error(`ZIP file exceeds maximum size of ${MAX_ZIP_SIZE / 1024 / 1024}MB.`);
  }

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  let totalUncompressedSize = 0;
  for (const entry of entries) {
    totalUncompressedSize += entry.header.size;
  }
  if (totalUncompressedSize > MAX_UNCOMPRESSED_SIZE) {
    updateJob(job, { status: "error", error: "ZIP uncompressed size too large." });
    throw new Error(`ZIP uncompressed size (${Math.round(totalUncompressedSize / 1024 / 1024)}MB) exceeds maximum of ${MAX_UNCOMPRESSED_SIZE / 1024 / 1024}MB.`);
  }

  const validEntries = entries.filter((entry: { isDirectory: boolean; entryName: string; header: { size: number } }) => {
    if (entry.isDirectory) return false;
    if (entry.entryName.includes("..")) return false;
    if (entry.entryName.startsWith("/")) return false;
    if (entry.entryName.includes("node_modules/")) return false;
    if (entry.entryName.includes(".git/")) return false;
    if (entry.entryName.includes("__MACOSX/")) return false;
    if (isBinaryFile(entry.entryName)) return false;
    if (entry.header.size > MAX_ENTRY_SIZE) return false;
    return true;
  });

  if (validEntries.length === 0) {
    updateJob(job, { status: "error", error: "No importable files." });
    throw new Error("ZIP file contains no importable text files.");
  }

  if (validEntries.length > MAX_ZIP_FILES) {
    updateJob(job, { status: "error", error: "Too many files." });
    throw new Error(`ZIP contains too many files (${validEntries.length}). Maximum is ${MAX_ZIP_FILES}.`);
  }

  const filenames = validEntries.map((e: { entryName: string }) => e.entryName);

  let rootPrefix = "";
  const firstEntry = filenames[0];
  const slashIdx = firstEntry.indexOf("/");
  if (slashIdx > 0) {
    const possibleRoot = firstEntry.substring(0, slashIdx + 1);
    if (filenames.every((f: string) => f.startsWith(possibleRoot))) {
      rootPrefix = possibleRoot;
    }
  }

  const lang = detectLanguageFromFiles(filenames);
  const project = await storage.createProject(userId, {
    name: projectName.slice(0, 50),
    language: lang,
    visibility: "private",
    outputType: "web",
    projectType: "web-app",
  });

  let importedCount = 0;
  const warnings: string[] = [];

  updateJob(job, {
    status: "importing",
    totalFiles: validEntries.length,
    message: `Extracting ${validEntries.length} files...`,
  });

  for (const entry of validEntries) {
    try {
      const content = entry.getData().toString("utf8");
      let filename = entry.entryName;
      if (rootPrefix && filename.startsWith(rootPrefix)) {
        filename = filename.substring(rootPrefix.length);
      }
      if (!filename) continue;
      await storage.createFile(project.id, {
        filename,
        content: content.slice(0, MAX_FILE_SIZE),
      });
      importedCount++;
      updateJob(job, {
        importedFiles: importedCount,
        currentFile: filename,
        message: `Extracted ${importedCount}/${validEntries.length} files...`,
      });
    } catch {
      warnings.push(`Failed to extract: ${entry.entryName}`);
    }
  }

  const result: ImportResult = {
    project: { id: project.id, name: project.name, language: project.language },
    fileCount: importedCount,
    warnings,
    requiredSecrets: [],
  };

  updateJob(job, { status: "complete", message: "Import complete", result });
  return { ...result, jobId: job.id };
}

const REACT_BOILERPLATE: Record<string, string> = {
  "package.json": JSON.stringify({
    name: "figma-import",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
    devDependencies: {
      "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0", typescript: "^5.5.0", vite: "^5.4.0",
    },
  }, null, 2),
  "vite.config.ts": `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`,
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      target: "ES2020", useDefineForClassFields: true, lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext", skipLibCheck: true, moduleResolution: "bundler",
      allowImportingTsExtensions: true, isolatedModules: true, moduleDetection: "force",
      noEmit: true, jsx: "react-jsx", strict: true, noUnusedLocals: true,
      noUnusedParameters: true, noFallthroughCasesInSwitch: true, noUncheckedSideEffectImports: true,
    },
    include: ["src"],
  }, null, 2),
  "index.html": `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>Figma Import</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
  "src/main.tsx": `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n`,
};

async function fetchFigmaDesignContextViaMcp(fileKey: string, nodeId?: string): Promise<string | null> {
  try {
    const mcpClientModule = await import("./mcpClient");
    const allServerIds = mcpClientModule.getActiveClientIds();
    const figmaId = allServerIds.find(id => id.toLowerCase().includes("figma"));
    const client = figmaId ? mcpClientModule.getClient(figmaId) : undefined;
    if (!client || client.status !== "running") return null;

    const toolArgs: Record<string, unknown> = {
      fileKey,
      clientLanguages: "typescript",
      clientFrameworks: "react",
    };
    if (nodeId) toolArgs.nodeId = nodeId;
    else toolArgs.nodeId = "0:1";

    const result = await client.callTool("get_design_context", toolArgs);
    if (result.isError) return null;

    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n\n");

    if (textContent.length > 50) return textContent;
    return null;
  } catch {
    return null;
  }
}

async function getFigmaToken(): Promise<string | null> {
  if (process.env.FIGMA_ACCESS_TOKEN) return process.env.FIGMA_ACCESS_TOKEN;
  try {
    const { ReplitConnectors } = await import("@replit/connectors-sdk");
    const connectors = new ReplitConnectors();
    const connections = await connectors.listConnections({ connector_names: "figma" });
    if (connections.length > 0) {
      const conn = connections[0];
      const settingsObj = (conn as Record<string, unknown>).settings as Record<string, string> | undefined;
      return settingsObj?.access_token || settingsObj?.token || settingsObj?.personal_access_token || null;
    }
  } catch {
  }
  return null;
}

async function fetchFigmaDesignContextViaRest(fileKey: string, nodeId?: string): Promise<string> {
  const token = await getFigmaToken();
  if (!token) {
    throw new Error("Figma integration not configured. Please connect your Figma account in the integrations settings, or set the FIGMA_ACCESS_TOKEN environment variable.");
  }

  const contextParts: string[] = [];

  const fileUrl = `https://api.figma.com/v1/files/${fileKey}${nodeId ? `/nodes?ids=${encodeURIComponent(nodeId)}` : "?depth=3"}`;
  const fileResp = await fetch(fileUrl, { headers: { "X-Figma-Token": token } });
  if (!fileResp.ok) {
    const errBody = await fileResp.text().catch(() => "");
    if (fileResp.status === 403 || fileResp.status === 401) {
      throw new Error("Figma access denied. Please check that your Figma integration token has access to this file.");
    }
    throw new Error(`Figma API error (${fileResp.status}): ${errBody.slice(0, 200)}`);
  }
  const fileData = await fileResp.json();
  contextParts.push(`File structure:\n${JSON.stringify(fileData).slice(0, 10000)}`);

  if (nodeId) {
    try {
      const imgUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=2`;
      const imgResp = await fetch(imgUrl, { headers: { "X-Figma-Token": token } });
      if (imgResp.ok) {
        const imgData = await imgResp.json();
        const images = imgData.images || {};
        const imageUrl = Object.values(images)[0];
        if (imageUrl) {
          contextParts.push(`Screenshot URL: ${imageUrl}`);
        }
      }
    } catch {
    }
  }

  try {
    const stylesUrl = `https://api.figma.com/v1/files/${fileKey}/styles`;
    const stylesResp = await fetch(stylesUrl, { headers: { "X-Figma-Token": token } });
    if (stylesResp.ok) {
      const stylesData = await stylesResp.json();
      if (stylesData.meta?.styles?.length > 0) {
        contextParts.push(`Design tokens/styles:\n${JSON.stringify(stylesData.meta.styles.slice(0, 20))}`);
      }
    }
  } catch {
  }

  return contextParts.join("\n\n");
}

export async function fetchFigmaDesignContext(fileKey: string, nodeId?: string): Promise<string> {
  const mcpResult = await fetchFigmaDesignContextViaMcp(fileKey, nodeId);
  if (mcpResult) return mcpResult;
  return fetchFigmaDesignContextViaRest(fileKey, nodeId);
}

export async function importFromFigma(
  userId: string,
  figmaUrl: string,
  projectName: string,
  aiProvider: "openai" | "anthropic" | "gemini" = "openai",
  preloadedDesignContext?: string,
  existingJob?: ImportJob,
): Promise<ImportResult & { jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  const projectCheck = await storage.checkProjectLimit(userId);
  if (!projectCheck.allowed) {
    updateJob(job, { status: "error", error: "Project limit reached." });
    throw new Error("Project limit reached. Upgrade your plan for more projects.");
  }

  updateJob(job, { status: "validating", message: "Parsing Figma URL..." });

  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    updateJob(job, { status: "error", error: "Invalid Figma URL." });
    throw new Error("Invalid Figma URL. Please provide a valid Figma file or frame URL.");
  }

  updateJob(job, { status: "importing", message: "Fetching Figma design context..." });

  let designContext: string;
  if (preloadedDesignContext && preloadedDesignContext.length > 50) {
    designContext = preloadedDesignContext.slice(0, 15000);
  } else {
    designContext = await fetchFigmaDesignContext(parsed.fileKey, parsed.nodeId);
  }

  updateJob(job, { message: "Generating React components from design..." });

  const componentCode = await generateReactFromDesign(designContext, aiProvider);

  updateJob(job, { message: "Creating project files..." });

  const project = await storage.createProject(userId, {
    name: projectName.slice(0, 50),
    language: "typescript",
    visibility: "private",
    outputType: "web",
    projectType: "web-app",
  });

  const allFiles = {
    ...REACT_BOILERPLATE,
    "src/App.tsx": `import FigmaComponent from './FigmaComponent';\n\nexport default function App() {\n  return (\n    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>\n      <FigmaComponent />\n    </div>\n  );\n}\n`,
    "src/FigmaComponent.tsx": componentCode,
  };

  const warnings: string[] = [];
  let importedCount = 0;
  const totalFiles = Object.keys(allFiles).length;
  updateJob(job, { totalFiles });

  for (const [filename, content] of Object.entries(allFiles)) {
    try {
      await storage.createFile(project.id, { filename, content });
      importedCount++;
      updateJob(job, {
        importedFiles: importedCount,
        currentFile: filename,
        message: `Created ${importedCount}/${totalFiles} files...`,
      });
    } catch {
      warnings.push(`Failed to create: ${filename}`);
    }
  }

  const result: ImportResult = {
    project: { id: project.id, name: project.name, language: project.language },
    fileCount: importedCount,
    warnings,
    requiredSecrets: [],
  };

  updateJob(job, { status: "complete", message: "Import complete", result });
  return { ...result, jobId: job.id };
}

function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("figma.com")) return null;

    const match = u.pathname.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
    if (!match) return null;

    const fileKey = match[2];
    const nodeId = u.searchParams.get("node-id") || undefined;
    return { fileKey, nodeId };
  } catch {
    return null;
  }
}

async function generateReactFromDesign(designContext: string, provider: "openai" | "anthropic" | "gemini"): Promise<string> {
  const prompt = `You are a React component generator. Based on the following Figma design context, generate a single clean, well-styled React component using TypeScript and inline styles (no external CSS). The component should be functional, responsive, and match the design as closely as possible. Only output the code, no explanations.

Design context:
${designContext}

Generate a complete React component file (FigmaComponent.tsx) with:
- TypeScript
- Inline styles or CSS-in-JS
- Responsive design
- Proper semantic HTML
- Export default the component`;

  try {
    if (provider === "anthropic") {
      const AnthropicSDK = (await import("@anthropic-ai/sdk")).default;
      const anthropic = new AnthropicSDK();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && "text" in textBlock ? textBlock.text : "";
      return extractCodeFromResponse(text);
    } else if (provider === "gemini") {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      return extractCodeFromResponse(response.text || "");
    } else {
      const OpenAISDK = (await import("openai")).default;
      const openai = new OpenAISDK();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      });
      return extractCodeFromResponse(response.choices[0]?.message?.content || "");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 100) : "unknown error";
    return `import React from 'react';\n\nexport default function FigmaComponent() {\n  return (\n    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'system-ui' }}>\n      <h1 style={{ fontSize: '24px', color: '#333' }}>Figma Import</h1>\n      <p style={{ color: '#666', marginTop: '12px' }}>AI generation encountered an issue: ${message}. Please edit this component manually.</p>\n    </div>\n  );\n}\n`;
  }
}

function extractCodeFromResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:tsx?|jsx?|react)?\s*\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  if (text.includes("import") && text.includes("export")) return text.trim();
  return `import React from 'react';\n\nexport default function FigmaComponent() {\n  return <div style={{ padding: '40px' }}>${text.slice(0, 500)}</div>;\n}\n`;
}

function getVercelToken(): string | null {
  return process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN || null;
}

export async function importFromVercel(
  userId: string,
  vercelUrl: string,
  projectName?: string,
  existingJob?: ImportJob,
): Promise<ImportResult & { envVarNames: string[]; jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  updateJob(job, { status: "validating", message: "Parsing Vercel project URL..." });

  const parsed = parseVercelUrl(vercelUrl);
  if (!parsed) {
    updateJob(job, { status: "error", error: "Invalid Vercel URL." });
    throw new Error("Invalid Vercel URL. Please provide a valid Vercel project URL (e.g., vercel.com/team/project).");
  }

  updateJob(job, { message: "Fetching Vercel project info..." });

  let repoUrl: string | null = null;
  let envVarNames: string[] = [];
  const vercelToken = getVercelToken();

  try {
    const params = new URLSearchParams();
    if (parsed.teamSlug) {
      params.set("slug", parsed.teamSlug);
    }
    const qs = params.toString() ? `?${params.toString()}` : "";
    const apiUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(parsed.projectName)}${qs}`;
    const headers: Record<string, string> = {};
    if (vercelToken) {
      headers["Authorization"] = `Bearer ${vercelToken}`;
    }
    const resp = await fetch(apiUrl, { headers });
    if (resp.ok) {
      const data = await resp.json();
      if (data.link?.type === "github" && data.link?.repo) {
        repoUrl = data.link.repo;
      } else if (data.link?.type === "github" && data.link?.org && data.link?.repoSlug) {
        repoUrl = `${data.link.org}/${data.link.repoSlug}`;
      }
      if (data.env && Array.isArray(data.env)) {
        envVarNames = data.env.map((e: { key?: string }) => e.key).filter(Boolean) as string[];
      }
    } else if (resp.status === 403 || resp.status === 401) {
      const authHint = vercelToken
        ? "Vercel token does not have access to this project."
        : "Vercel project requires authentication. Set the VERCEL_TOKEN environment variable, or import the linked GitHub repository directly.";
      updateJob(job, { status: "error", error: authHint });
      throw new Error(authHint);
    } else if (resp.status === 404) {
      updateJob(job, { status: "error", error: "Vercel project not found. Check the URL and try again." });
      throw new Error("Vercel project not found. Check the URL and try again.");
    }
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("Vercel") || err.message.includes("VERCEL"))) throw err;
  }

  if (!repoUrl) {
    updateJob(job, { status: "error", error: "No linked GitHub repository found." });
    throw new Error("Could not find a linked GitHub repository for this Vercel project. Make sure the project is public or provide the GitHub repo URL directly.");
  }

  updateJob(job, { message: "Importing linked GitHub repository..." });

  let owner: string, repo: string;
  const ghParsed = parseGitHubRepoUrl(`https://github.com/${repoUrl}`);
  const ghParsedDirect = parseGitHubRepoUrl(repoUrl);
  if (ghParsedDirect) {
    owner = ghParsedDirect.owner;
    repo = ghParsedDirect.repo;
  } else if (ghParsed) {
    owner = ghParsed.owner;
    repo = ghParsed.repo;
  } else if (repoUrl.includes("/")) {
    const parts = repoUrl.split("/").filter(Boolean);
    owner = parts[parts.length - 2] || "";
    repo = (parts[parts.length - 1] || "").replace(".git", "");
  } else {
    owner = "";
    repo = "";
  }
  if (!owner || !repo) {
    updateJob(job, { status: "error", error: "Could not parse GitHub repo." });
    throw new Error("Could not parse GitHub repo from Vercel project.");
  }

  const result = await importFromGitHub(userId, owner, repo, projectName || parsed.projectName, undefined, MAX_FILES_DEFAULT, job);
  result.warnings.push("Imported from Vercel-linked GitHub repository.");

  if (envVarNames.length > 0) {
    result.requiredSecrets = envVarNames;
    result.warnings.push(`This project uses ${envVarNames.length} environment variable(s). Please configure them before running.`);
  }

  updateJob(job, { status: "complete", message: "Import complete", result });
  return { ...result, envVarNames, jobId: job.id };
}

function parseVercelUrl(url: string): { teamSlug?: string; projectName: string } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!u.hostname.includes("vercel.com") && !u.hostname.includes("vercel.app")) return null;

    if (u.hostname.endsWith(".vercel.app")) {
      const projectName = u.hostname.replace(".vercel.app", "");
      return { projectName };
    }

    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return { teamSlug: parts[0], projectName: parts[1] };
    } else if (parts.length === 1) {
      return { projectName: parts[0] };
    }
    return null;
  } catch {
    return null;
  }
}

export async function importFromBolt(
  userId: string,
  repoUrl: string,
  projectName?: string,
  existingJob?: ImportJob,
): Promise<ImportResult & { jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  updateJob(job, { status: "validating", message: "Validating Bolt repository..." });

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    updateJob(job, { status: "error", error: "Invalid GitHub repository URL." });
    throw new Error("Invalid GitHub repository URL.");
  }

  updateJob(job, { message: "Importing from GitHub..." });
  const result = await importFromGitHub(userId, parsed.owner, parsed.repo, projectName, undefined, MAX_FILES_DEFAULT, job);

  updateJob(job, { status: "processing", message: "Scanning for Bolt configuration and secrets..." });

  const files = await storage.getFiles(result.project.id);
  const filenames = files.map(f => f.filename);
  const warnings = [...result.warnings];
  const requiredSecrets: string[] = [];

  if (filenames.some(f => f.startsWith(".bolt/") || f === ".bolt")) {
    warnings.push("Bolt configuration detected (.bolt/). Some settings may need manual adjustment.");
  }

  const supabaseSecrets = detectSupabaseSecrets(files);
  requiredSecrets.push(...supabaseSecrets);

  const envSecrets = detectEnvSecrets(files);
  requiredSecrets.push(...envSecrets);

  const uniqueSecrets = Array.from(new Set(requiredSecrets));

  if (uniqueSecrets.length > 0) {
    warnings.push(`Detected ${uniqueSecrets.length} secret(s) that need manual setup: ${uniqueSecrets.join(", ")}`);
  }

  const importResult: ImportResult = {
    ...result,
    warnings,
    requiredSecrets: uniqueSecrets,
  };

  updateJob(job, { status: "complete", message: "Import complete", result: importResult });
  return { ...importResult, jobId: job.id };
}

export async function importFromLovable(
  userId: string,
  repoUrl: string,
  projectName?: string,
  existingJob?: ImportJob,
): Promise<ImportResult & { jobId: string }> {
  cleanupOldJobs();
  const job = existingJob || createJob(userId);

  updateJob(job, { status: "validating", message: "Validating Lovable repository..." });

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    updateJob(job, { status: "error", error: "Invalid GitHub repository URL." });
    throw new Error("Invalid GitHub repository URL.");
  }

  updateJob(job, { message: "Importing from GitHub..." });
  const result = await importFromGitHub(userId, parsed.owner, parsed.repo, projectName, undefined, MAX_FILES_DEFAULT, job);

  updateJob(job, { status: "processing", message: "Scanning for Lovable configuration and secrets..." });

  const files = await storage.getFiles(result.project.id);
  const filenames = files.map(f => f.filename);
  const warnings = [...result.warnings];
  const requiredSecrets: string[] = [];

  if (filenames.some(f => f.startsWith(".lovable/") || f === ".lovable")) {
    warnings.push("Lovable configuration detected (.lovable/). Some settings may need manual adjustment.");
  }

  const supabaseSecrets = detectSupabaseSecrets(files);
  requiredSecrets.push(...supabaseSecrets);

  const envSecrets = detectEnvSecrets(files);
  requiredSecrets.push(...envSecrets);

  const uniqueSecrets = Array.from(new Set(requiredSecrets));

  if (uniqueSecrets.length > 0) {
    warnings.push(`Detected ${uniqueSecrets.length} secret(s) that need manual setup: ${uniqueSecrets.join(", ")}`);
  }

  const importResult: ImportResult = {
    ...result,
    warnings,
    requiredSecrets: uniqueSecrets,
  };

  updateJob(job, { status: "complete", message: "Import complete", result: importResult });
  return { ...importResult, jobId: job.id };
}

function parseGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(".git", "") };
  } catch {
    return null;
  }
}

function detectSupabaseSecrets(files: { filename: string; content: string | null }[]): string[] {
  const secrets: string[] = [];
  const supabasePatterns = [
    "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ];

  for (const file of files) {
    if (!file.content) continue;
    for (const pattern of supabasePatterns) {
      if (file.content.includes(pattern) && !secrets.includes(pattern)) {
        secrets.push(pattern);
      }
    }
  }

  if (files.some(f => f.filename.includes("supabase") && f.filename.endsWith(".sql"))) {
    if (!secrets.includes("SUPABASE_URL")) secrets.push("SUPABASE_URL");
    if (!secrets.includes("SUPABASE_ANON_KEY")) secrets.push("SUPABASE_ANON_KEY");
  }

  return secrets;
}

function detectEnvSecrets(files: { filename: string; content: string | null }[]): string[] {
  const secrets: string[] = [];
  const envFile = files.find(f => f.filename === ".env.example" || f.filename === ".env.local.example" || f.filename === ".env.template");

  if (envFile?.content) {
    const lines = envFile.content.split("\n");
    for (const line of lines) {
      const match = line.match(/^([A-Z][A-Z0-9_]+)=/);
      if (match && !secrets.includes(match[1])) {
        secrets.push(match[1]);
      }
    }
  }

  const commonSecretPatterns = [
    "DATABASE_URL", "API_KEY", "SECRET_KEY", "JWT_SECRET",
    "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY",
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
  ];

  for (const file of files) {
    if (!file.content) continue;
    if (file.filename.endsWith(".env") || file.filename.endsWith(".env.local")) continue;
    for (const pattern of commonSecretPatterns) {
      if (file.content.includes(`process.env.${pattern}`) || file.content.includes(`import.meta.env.${pattern}`)) {
        if (!secrets.includes(pattern)) {
          secrets.push(pattern);
        }
      }
    }
  }

  return secrets;
}

export function validateZipBuffer(buffer: Buffer): ValidationResult {
  if (buffer.length > MAX_ZIP_SIZE) {
    return { valid: false, compatible: false, reasons: [`ZIP file exceeds maximum size of ${MAX_ZIP_SIZE / 1024 / 1024}MB.`] };
  }
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const validEntries = entries.filter((entry: { isDirectory: boolean; entryName: string }) => {
      if (entry.isDirectory) return false;
      if (entry.entryName.includes("..") || entry.entryName.startsWith("/")) return false;
      if (entry.entryName.includes("node_modules/") || entry.entryName.includes(".git/")) return false;
      return true;
    });
    if (validEntries.length === 0) {
      return { valid: false, compatible: false, reasons: ["ZIP file contains no importable files."] };
    }
    if (validEntries.length > MAX_ZIP_FILES) {
      return { valid: false, compatible: false, reasons: [`ZIP contains too many files (${validEntries.length}). Maximum is ${MAX_ZIP_FILES}.`] };
    }
    const filenames = validEntries.map((e: { entryName: string }) => e.entryName);
    const lang = detectLanguageFromFiles(filenames);
    return { valid: true, compatible: true, reasons: [], detectedLanguage: lang, fileCount: validEntries.length };
  } catch {
    return { valid: false, compatible: false, reasons: ["Could not read ZIP file. It may be corrupted."] };
  }
}

export async function validateImportSource(
  source: string,
  input: string,
): Promise<ValidationResult> {
  switch (source) {
    case "github": {
      const parsed = parseGitHubRepoUrl(input);
      if (!parsed) return { valid: false, compatible: false, reasons: ["Invalid GitHub URL. Expected format: https://github.com/owner/repo"] };
      try {
        const repoInfo = await github.getRepo(parsed.owner, parsed.repo);
        const treeResult = await github.getRepoTree(parsed.owner, parsed.repo, repoInfo.default_branch || "main");
        const filenames = treeResult.tree.map((t: { path: string }) => t.path);
        const lang = detectLanguageFromGitHub(repoInfo.language, filenames);
        const reasons: string[] = [];
        const textFiles = filenames.filter((f: string) => !isBinaryFile(f));
        if (textFiles.length === 0) {
          return { valid: true, compatible: false, reasons: ["Repository contains no importable text files."], detectedLanguage: lang, fileCount: 0 };
        }
        if (textFiles.length > MAX_FILES_DEFAULT) {
          reasons.push(`Large repository (${textFiles.length} files). Import will be limited to ${MAX_FILES_DEFAULT} files.`);
        }
        const hasPackageJson = filenames.includes("package.json");
        const hasRequirements = filenames.includes("requirements.txt") || filenames.includes("Pipfile");
        const hasCargoToml = filenames.includes("Cargo.toml");
        const hasGoMod = filenames.includes("go.mod");
        if (!hasPackageJson && !hasRequirements && !hasCargoToml && !hasGoMod) {
          reasons.push("No standard dependency file detected (package.json, requirements.txt, etc.). Project may need manual setup.");
        }
        return { valid: true, compatible: true, reasons, detectedLanguage: lang, fileCount: treeResult.tree.length };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Repository not accessible";
        return { valid: false, compatible: false, reasons: [message] };
      }
    }
    case "figma": {
      const parsed = parseFigmaUrl(input);
      if (!parsed) return { valid: false, compatible: false, reasons: ["Invalid Figma URL. Expected format: https://www.figma.com/design/..."] };
      return { valid: true, compatible: true, reasons: [], detectedLanguage: "typescript" };
    }
    case "vercel": {
      const parsed = parseVercelUrl(input);
      if (!parsed) return { valid: false, compatible: false, reasons: ["Invalid Vercel URL."] };
      try {
        const vParams = new URLSearchParams();
        if (parsed.teamSlug) vParams.set("slug", parsed.teamSlug);
        const vQs = vParams.toString() ? `?${vParams.toString()}` : "";
        const apiUrl = `https://api.vercel.com/v9/projects/${encodeURIComponent(parsed.projectName)}${vQs}`;
        const vHeaders: Record<string, string> = {};
        const vToken = getVercelToken();
        if (vToken) vHeaders["Authorization"] = `Bearer ${vToken}`;
        const resp = await fetch(apiUrl, { headers: vHeaders });
        if (!resp.ok) {
          if (resp.status === 401 || resp.status === 403) {
            const hint = vToken
              ? "Vercel token does not have access to this project."
              : "Vercel project requires authentication. Set the VERCEL_TOKEN environment variable, or import the GitHub repo directly.";
            return { valid: false, compatible: false, reasons: [hint] };
          }
          return { valid: false, compatible: false, reasons: ["Vercel project not found or not accessible."] };
        }
        const vData = await resp.json();
        const hasGithubLink = vData.link?.type === "github";
        return { valid: true, compatible: hasGithubLink, reasons: hasGithubLink ? [] : ["No linked GitHub repository found. Import may not work."], detectedLanguage: "javascript" };
      } catch {
        return { valid: false, compatible: false, reasons: ["Could not reach Vercel API to verify project."] };
      }
    }
    case "bolt":
    case "lovable": {
      const parsed = parseGitHubRepoUrl(input);
      if (!parsed) return { valid: false, compatible: false, reasons: ["Invalid GitHub URL for repository."] };
      try {
        await github.getRepo(parsed.owner, parsed.repo);
        return { valid: true, compatible: true, reasons: [] };
      } catch {
        return { valid: false, compatible: false, reasons: ["Repository not accessible"] };
      }
    }
    case "zip":
      return { valid: false, compatible: false, reasons: ["ZIP validation requires file upload. Use the ZIP upload endpoint directly."] };
    default:
      return { valid: false, compatible: false, reasons: ["Unknown import source"] };
  }
}
