// AUTO-EXTRACTED from server/routes.ts (lines 9699-10677)
// Original section: security-scanner
// Extracted by scripts/batch-extract-routes.cjs

import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "../storage";
import { AGENT_MODE_COSTS, AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, AUTONOMOUS_TIER_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier, type InsertDeployment, type CheckpointStateSnapshot, insertThemeSchema, insertArtifactSchema, ARTIFACT_TYPES, type SlideData, type SlideTheme, MODEL_TOKEN_PRICING, SERVICE_CREDIT_COSTS, OVERAGE_RATE_PER_CREDIT, calculateTokenCredits, getProviderPricing, insertUserSchema, insertProjectSchema, insertFileSchema, UPLOAD_LIMITS, STORAGE_PLAN_LIMITS } from "@shared/schema";
import { decrypt, encrypt } from "../encryption";
import { z } from "zod";
import { executeCode, sendStdinToProcess, killInteractiveProcess, resolveRunCommand } from "../executor";
import { getProjectConfig, parseReplitConfig, serializeReplitConfig, getEnvironmentMetadata, type ReplitConfig } from "../configParser";
import { parseReplitNix, serializeReplitNix } from "../nixParser";
import { executionPool } from "../executionPool";
import { getOrCreateTerminal, createTerminalSession, resizeTerminal, listTerminalSessions, destroyTerminalSession, setSessionSelected, updateLastCommand, updateLastActivity, materializeProjectFiles as materializeTerminalFiles, getProjectWorkspaceDir, invalidateProjectWorkspace, syncFileToWorkspace, deleteFileFromWorkspace, renameFileInWorkspace, listWorkspaceFiles, destroyProjectTerminals } from "../terminal";
import { createDebugSession, connectToInspector, handleDebugCommand, getDebugSession, cleanupSession, getInspectPort } from "../debugger";
import { log } from "../index";
import { sendPasswordResetEmail, sendVerificationEmail, sendTeamInviteEmail, isEmailConfigured } from "../email";
import { buildAndDeploy, buildAndDeployMultiArtifact, createDeploymentRouter, rollbackDeployment, listDeploymentVersions, teardownDeployment, performHealthCheck, getProcessLogs, getProcessStatus, stopManagedProcess, restartManagedProcess, shutdownAllProcesses, cleanupProjectProcesses, setProcessLogCallback } from "../deploymentEngine";
import { getProcessInfo } from "../processManager";
import type { DeploymentType } from "../deploymentEngine";
import { incrementRequests, incrementErrors, recordResponseTime, getAndResetCounters, getRealMetrics } from "../metricsCollector";
import { DEFAULT_SHORTCUTS, isValidShortcutValue, findConflict, mergeWithDefaults } from "@shared/keyboardShortcuts";
import { createCheckpoint, restoreCheckpoint, getCheckpointDiff } from "../checkpointService";
import { triggerBackupAsync, createBackup, restoreFromBackup, getBackupStatus, verifyBackupIntegrity } from "../gitBackupService";
import { addDomain, verifyDomain, removeDomain, getProjectDomains, getDomainById, getACMEChallengeResponse } from "../domainManager";
import { checkUserRateLimit, checkIpRateLimit, acquireExecutionSlot, releaseExecutionSlot, recordExecution, getExecutionMetrics, getSystemMetrics, getClientIp } from "../rateLimiter";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI, Type, type FunctionDeclaration, type Tool, type Content } from "@google/genai";
import { diffArrays } from "diff";
import multer from "multer";
import * as runnerClient from "../runnerClient";
import * as github from "../github";
import * as gitService from "../git";
import { getConnectorKey, getSupportedConnectors, getConnectorOperations, executeConnectorOperation, getConnectorDescription } from "../connectors";
import path_ from "path";
import { posix as pathPosix } from "path";
import { generateImageBuffer, editImages } from "../replit_integrations/image/client";
import { registerImageRoutes } from "../replit_integrations/image";
import { searchBraveImages, BRAVE_CREDIT_COST, generateSpeech, AVAILABLE_VOICES, TTS_CREDIT_COST, generateNanoBananaImage, NANOBANANA_CREDIT_COST, generateDalleImage, DALLE_CREDIT_COST, searchTavily, TAVILY_CREDIT_COST } from "../agentServices";
import { generateFile, getMimeType, type FileGenerationInput, type FileSection } from "../fileGeneration";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import { importFromGitHub, importFromZip, importFromFigma, importFromVercel, importFromBolt, importFromLovable, validateImportSource, startAsyncImport, startAsyncZipImport, getImportJob, validateZipBuffer, fetchFigmaDesignContext } from "../importService";
import { handleLSPConnection } from "../lspBridge";
import { getTemplateById, getAllTemplates } from "../templates";
import { generateEcodeContent, getEcodeFilename, buildProjectStructureTree, detectDependencies, detectDependenciesFromPackageJson, parseUserPreferences, parseProjectContext, updateEcodeStructureSection, buildEcodePromptContext, shouldAutoUpdate } from "../ecodeTemplates";
import { addCollaborator, removeCollaborator, getCollaborators, updateActiveFile, broadcastToCollaborators, broadcastPresence, getOrCreateFileDoc, initializeFileDoc, getFileDocContent, broadcastBinaryToCollaborators, setFilePersister, type CollabMessage, Y } from "../collaboration";
import bcrypt from "bcrypt";
import crypto from "crypto";


export async function registerSecurityScannerRoutes(app: Express, ctx: any): Promise<void> {
  const {
    requireAuth, csrfProtection, authLimiter, apiLimiter, aiLimiter, aiGenerateLimiter,
    runLimiter, checkoutLimiter, errorBuffer, MAX_ERROR_BUFFER, serverStartTime,
    broadcastToProject, broadcastToUser, wsClients, wsUserClients,
    verifyProjectAccess, verifyRecaptcha, qstr, safeError, sanitizeAIFileContent,
    validateExternalUrl, getAppUrl, generateCsrfToken, sessionMiddleware, httpServer,
  } = ctx;
  const path = path_;


  // --- SECURITY SCANNER ---

  async function verifyProjectWriteAccess(projectId: string, userId: string): Promise<boolean> {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    if (String(project.userId) === String(userId)) return true;
    if (project.teamId) {
      const teams = await storage.getUserTeams(userId);
      const teamMatch = teams.find(t => t.id === project.teamId);
      if (teamMatch && (teamMatch.role === "owner" || teamMatch.role === "admin" || teamMatch.role === "editor")) return true;
    }
    const guest = await storage.getProjectGuestByUserId(projectId, userId);
    if (guest && guest.role === "editor") return true;
    const usr = await storage.getUser(userId);
    if (usr) {
      const invite = await storage.getAcceptedInviteForProject(projectId, usr.email.toLowerCase());
      if (invite && invite.role === "editor") return true;
    }
    return false;
  }

  app.post("/api/projects/:id/security/scan", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const SCAN_TIMEOUT_MS = 25000;
      const scanStartTime = Date.now();
      let timedOut = false;

      function checkTimeout(): boolean {
        if (Date.now() - scanStartTime > SCAN_TIMEOUT_MS) {
          timedOut = true;
          return true;
        }
        return false;
      }

      const scan = await storage.createSecurityScan({ projectId, userId });
      const projectFiles = await storage.getFiles(projectId);

      type FindingEntry = { severity: string; title: string; description: string; file: string; line: number | null; code: string | null; suggestion: string | null; category: string; isDirect?: boolean | null };
      const findings: FindingEntry[] = [];

      const regexPatterns = [
        { pattern: /\b(password|passwd|secret|api_key|apikey|api[-_]?secret|token|auth[-_]?token)\s*[:=]\s*["'`][^"'`]{4,}["'`]/gi, severity: "critical", title: "Hardcoded secret/credential", description: "Hardcoded secrets in source code can be exposed if the code is shared or committed.", suggestion: "Use environment variables or a secrets manager instead." },
        { pattern: /["'`](sk-[a-zA-Z0-9]{20,})["'`]/g, severity: "critical", title: "Hardcoded API key (OpenAI pattern)", description: "API keys should never be hardcoded in source code.", suggestion: "Store API keys in environment variables." },
        { pattern: /["'`](ghp_[a-zA-Z0-9]{36,})["'`]/g, severity: "critical", title: "Hardcoded GitHub token", description: "GitHub personal access tokens should not be in source code.", suggestion: "Use environment variables for tokens." },
        { pattern: /\$\{.*\}\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)/gi, severity: "high", title: "Potential SQL injection", description: "String interpolation in SQL queries can lead to SQL injection attacks.", suggestion: "Use parameterized queries or an ORM." },
        { pattern: /["'`]\s*(?:SELECT|INSERT|UPDATE|DELETE)\s+.*\+\s*/gi, severity: "high", title: "SQL string concatenation", description: "Building SQL queries with string concatenation is vulnerable to SQL injection.", suggestion: "Use parameterized queries with placeholders." },
        { pattern: /innerHTML\s*=/g, severity: "high", title: "Direct innerHTML assignment", description: "Setting innerHTML with user input can lead to XSS attacks.", suggestion: "Use textContent or a DOM sanitization library like DOMPurify." },
        { pattern: /document\.write\s*\(/g, severity: "high", title: "Use of document.write()", description: "document.write() can be exploited for XSS attacks.", suggestion: "Use DOM manipulation methods instead." },
        { pattern: /dangerouslySetInnerHTML/g, severity: "medium", title: "React dangerouslySetInnerHTML", description: "dangerouslySetInnerHTML bypasses React's XSS protections.", suggestion: "Sanitize content with DOMPurify before using dangerouslySetInnerHTML." },
        { pattern: /fs\.(readFile|writeFile|unlink|rmdir|readdir)\s*\([^)]*(?:req\.|params\.|query\.)/g, severity: "high", title: "User input in filesystem operation", description: "Passing user input directly to filesystem operations can lead to path traversal.", suggestion: "Validate file paths against an allow list or base directory." },
        { pattern: /(?:cors\(\s*\)|Access-Control-Allow-Origin.*\*)/g, severity: "medium", title: "Permissive CORS configuration", description: "Allowing all origins can expose the API to cross-origin attacks.", suggestion: "Restrict CORS to specific trusted origins." },
        { pattern: /Math\.random\s*\(\)/g, severity: "low", title: "Weak random number generation", description: "Math.random() is not cryptographically secure.", suggestion: "Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive values." },
        { pattern: /console\.(log|debug|info)\s*\(/g, severity: "info", title: "Console logging", description: "Console logging may leak sensitive information in production.", suggestion: "Remove or guard console statements in production code." },
        { pattern: /(?:http:\/\/)/g, severity: "low", title: "HTTP URL (insecure)", description: "Using HTTP instead of HTTPS can expose data in transit.", suggestion: "Use HTTPS URLs for secure communication." },
      ];

      const pythonRegexPatterns = [
        { pattern: /\bexec\s*\(/g, severity: "critical", title: "Use of exec()", description: "exec() executes arbitrary Python code and can lead to code injection.", suggestion: "Avoid exec(); use safe alternatives or controlled evaluation." },
        { pattern: /\beval\s*\(/g, severity: "critical", title: "Use of eval()", description: "eval() executes arbitrary expressions and can lead to code injection.", suggestion: "Use ast.literal_eval() for safe evaluation of literals." },
        { pattern: /\bos\.system\s*\(/g, severity: "critical", title: "Use of os.system()", description: "os.system() executes shell commands and is vulnerable to injection.", suggestion: "Use subprocess.run() with a list of arguments instead." },
        { pattern: /\bsubprocess\.\w+\s*\([^)]*shell\s*=\s*True/g, severity: "high", title: "Subprocess with shell=True", description: "Using shell=True with subprocess allows shell injection attacks.", suggestion: "Use subprocess with a list of arguments and shell=False." },
        { pattern: /\bpickle\.(load|loads)\s*\(/g, severity: "high", title: "Unsafe pickle deserialization", description: "Deserializing untrusted data with pickle can execute arbitrary code.", suggestion: "Use json or a safe serialization format instead of pickle for untrusted data." },
        { pattern: /\b__import__\s*\(/g, severity: "medium", title: "Dynamic import with __import__", description: "Dynamic imports can load arbitrary modules if input is not controlled.", suggestion: "Use static imports or validate module names against an allow list." },
        { pattern: /\bformat\s*\(.*\bsql\b|\bf["'].*\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi, severity: "high", title: "Potential SQL injection in Python", description: "String formatting in SQL queries is vulnerable to injection.", suggestion: "Use parameterized queries with %s or ? placeholders." },
      ];

      const goRegexPatterns = [
        { pattern: /\bunsafe\./g, severity: "high", title: "Use of unsafe package", description: "The unsafe package bypasses Go's type safety guarantees.", suggestion: "Avoid unsafe unless absolutely necessary; use safe alternatives." },
        { pattern: /\bsql\.Query\s*\([^)]*\+/g, severity: "critical", title: "SQL injection in Go", description: "String concatenation in sql.Query is vulnerable to SQL injection.", suggestion: "Use parameterized queries with $1, $2 placeholders." },
        { pattern: /\bexec\.Command\s*\([^)]*\+/g, severity: "critical", title: "Command injection in Go", description: "Dynamic string in exec.Command can lead to command injection.", suggestion: "Validate and sanitize all command arguments." },
        { pattern: /\bfmt\.Sprintf\s*\([^)]*(?:SELECT|INSERT|UPDATE|DELETE)/gi, severity: "high", title: "SQL via fmt.Sprintf in Go", description: "Using fmt.Sprintf for SQL queries is vulnerable to injection.", suggestion: "Use parameterized queries instead of string formatting." },
      ];

      const rustRegexPatterns = [
        { pattern: /\bunsafe\s*\{/g, severity: "medium", title: "Unsafe block in Rust", description: "Unsafe blocks bypass Rust's safety guarantees.", suggestion: "Minimize unsafe usage; document safety invariants." },
        { pattern: /\.unwrap\(\)/g, severity: "low", title: "Use of .unwrap() in Rust", description: "unwrap() will panic on None/Err in production.", suggestion: "Use pattern matching, unwrap_or, or the ? operator instead." },
        { pattern: /\bstd::process::Command::new\s*\([^)]*\+/g, severity: "high", title: "Command injection in Rust", description: "Dynamic arguments to Command::new can lead to command injection.", suggestion: "Validate and sanitize all command arguments." },
      ];

      const phpRegexPatterns = [
        { pattern: /\beval\s*\(/g, severity: "critical", title: "Use of eval() in PHP", description: "eval() executes arbitrary PHP code.", suggestion: "Avoid eval(); use safe alternatives." },
        { pattern: /\b(exec|system|passthru|shell_exec|popen|proc_open)\s*\(/g, severity: "critical", title: "Command execution in PHP", description: "Shell execution functions can lead to command injection.", suggestion: "Use escapeshellarg() and escapeshellcmd() to sanitize inputs." },
        { pattern: /\bunserialize\s*\(/g, severity: "high", title: "Unsafe unserialize() in PHP", description: "unserialize() with untrusted data can lead to object injection.", suggestion: "Use json_decode() instead of unserialize() for untrusted data." },
        { pattern: /\$_(GET|POST|REQUEST|COOKIE)\s*\[/g, severity: "medium", title: "Direct superglobal access in PHP", description: "Using superglobals directly without validation is risky.", suggestion: "Validate and sanitize all user input from superglobals." },
        { pattern: /\bmysqli?_query\s*\([^)]*\$/g, severity: "critical", title: "SQL injection in PHP", description: "Variable interpolation in SQL queries is vulnerable to injection.", suggestion: "Use prepared statements with PDO or mysqli." },
      ];

      const rubyRegexPatterns = [
        { pattern: /\beval\s*\(/g, severity: "critical", title: "Use of eval() in Ruby", description: "eval() executes arbitrary Ruby code.", suggestion: "Avoid eval(); use safe alternatives." },
        { pattern: /\b(system|exec|%x|`)\s*[^)]*\#\{/g, severity: "critical", title: "Command injection in Ruby", description: "String interpolation in system commands can lead to injection.", suggestion: "Use parameterized arrays with system() or Open3." },
        { pattern: /\.send\s*\(/g, severity: "medium", title: "Dynamic method call with send() in Ruby", description: "send() can invoke any method, including private ones.", suggestion: "Use public_send() and validate method names." },
        { pattern: /\bMarshal\.load\s*\(/g, severity: "high", title: "Unsafe Marshal.load in Ruby", description: "Deserializing untrusted data with Marshal can execute arbitrary code.", suggestion: "Use JSON.parse or YAML.safe_load for untrusted data." },
      ];

      const javaRegexPatterns = [
        { pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/g, severity: "critical", title: "Runtime.exec() in Java", description: "Runtime.exec() can execute arbitrary system commands.", suggestion: "Use ProcessBuilder with argument arrays and validate inputs." },
        { pattern: /\bStatement\b.*\bexecute(?:Query|Update)\s*\([^)]*\+/g, severity: "critical", title: "SQL injection in Java", description: "String concatenation in SQL statements is vulnerable to injection.", suggestion: "Use PreparedStatement with parameterized queries." },
        { pattern: /\bObjectInputStream\b/g, severity: "high", title: "Unsafe deserialization in Java", description: "ObjectInputStream can deserialize malicious objects.", suggestion: "Use serialization filters or JSON instead." },
        { pattern: /DocumentBuilderFactory.*setFeature.*false|!.*setFeature/g, severity: "high", title: "Potential XXE vulnerability in Java", description: "XML parsing without disabling external entities is vulnerable to XXE.", suggestion: "Disable external entities in DocumentBuilderFactory." },
      ];

      const cppRegexPatterns = [
        { pattern: /\bgets\s*\(/g, severity: "critical", title: "Use of gets() in C/C++", description: "gets() has no buffer size limit and always causes buffer overflow.", suggestion: "Use fgets() with a size limit instead." },
        { pattern: /\bstrcpy\s*\(/g, severity: "high", title: "Use of strcpy() in C/C++", description: "strcpy() does not check buffer boundaries.", suggestion: "Use strncpy() or strlcpy() with size limits." },
        { pattern: /\bsprintf\s*\(/g, severity: "high", title: "Use of sprintf() in C/C++", description: "sprintf() can cause buffer overflow.", suggestion: "Use snprintf() with a size limit." },
        { pattern: /\bscanf\s*\(\s*"%s"/g, severity: "high", title: "Unbounded scanf %s in C/C++", description: "scanf with %s has no length limit.", suggestion: "Use scanf with width specifier like %255s." },
        { pattern: /\bmalloc\s*\([^)]*\*[^)]*\)/g, severity: "medium", title: "Integer overflow risk in malloc", description: "Multiplying sizes in malloc can overflow.", suggestion: "Check for overflow before allocation or use calloc()." },
        { pattern: /\bsystem\s*\(/g, severity: "high", title: "Use of system() in C/C++", description: "system() executes shell commands and is vulnerable to injection.", suggestion: "Use exec family functions with argument arrays." },
      ];

      const piiFieldNames = /\b(email|e_mail|phone|phone_number|phoneNumber|ssn|social_security|socialSecurity|address|street_address|streetAddress|password|passwd|credit_card|creditCard|card_number|cardNumber|dob|date_of_birth|dateOfBirth|birth_date|birthDate|first_name|firstName|last_name|lastName|full_name|fullName|ip_address|ipAddress|bank_account|bankAccount|routing_number|routingNumber|passport|driver_license|driverLicense)\b/gi;

      const riskySinks = [
        /console\.(log|debug|info|warn|error)\s*\(/g,
        /logger\.\w+\s*\(/g,
        /fs\.(writeFile|appendFile|writeFileSync|appendFileSync|createWriteStream)\s*\(/g,
        /fetch\s*\([^)]*\{[^}]*body\s*:/g,
        /axios\.(post|put|patch)\s*\(/g,
        /\.send\s*\(/g,
        /print\s*\(/g,
        /logging\.\w+\s*\(/g,
        /open\s*\([^)]*["'][wa]/g,
      ];

      function runPrivacyScan(content: string, filename: string): FindingEntry[] {
        const privacyFindings: FindingEntry[] = [];
        const fileLines = content.split("\n");
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          piiFieldNames.lastIndex = 0;
          const piiMatch = piiFieldNames.exec(line);
          if (piiMatch) {
            for (const sinkPattern of riskySinks) {
              sinkPattern.lastIndex = 0;
              if (sinkPattern.test(line)) {
                privacyFindings.push({
                  severity: "high",
                  title: `PII field "${piiMatch[1]}" exposed in risky sink`,
                  description: `Sensitive data field "${piiMatch[1]}" is being passed to a logging, file write, or network call that may expose it.`,
                  file: filename,
                  line: i + 1,
                  code: line.trim().slice(0, 200),
                  suggestion: "Redact or mask PII before logging or transmitting. Use a data sanitization layer.",
                  category: "privacy",
                });
                break;
              }
            }
          }
        }
        return privacyFindings;
      }

      const maliciousFilenames = new Set([
        "setup_bun.js", "setup-env.js", "preinstall.js", "postinstall.js",
        ".env.production.bak", "webpack.config.bak.js", "config.bak.js",
      ]);

      const suspiciousPatterns = [
        { pattern: /[A-Za-z0-9+/=]{200,}/g, severity: "high" as const, title: "Long Base64-encoded string detected", description: "Very long base64 strings may indicate obfuscated malicious payloads." },
        { pattern: /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){20,}/g, severity: "high" as const, title: "Hex-encoded string chain detected", description: "Long hex-encoded strings can hide malicious code from static analysis." },
        { pattern: /eval\s*\(\s*(?:atob|Buffer\.from|decodeURIComponent)\s*\(/g, severity: "critical" as const, title: "Obfuscated eval chain detected", description: "eval() combined with decoding functions is a common obfuscation technique for malware." },
        { pattern: /(?:stratum\+tcp|coinhive|cryptonight|minergate|nicehash|xmrig)/gi, severity: "critical" as const, title: "Crypto mining indicator detected", description: "References to crypto mining pools or software detected in source code." },
        { pattern: /new\s+WebSocket\s*\([^)]*(?:pool\.|mine\.|stratum)/gi, severity: "critical" as const, title: "WebSocket connection to mining pool", description: "WebSocket connecting to what appears to be a crypto mining pool." },
      ];

      function runMaliciousFileScan(files: typeof projectFiles): FindingEntry[] {
        const malFindings: FindingEntry[] = [];
        for (const file of files) {
          const basename = file.filename.split("/").pop() || "";
          if (maliciousFilenames.has(basename)) {
            malFindings.push({
              severity: "high",
              title: `Suspicious filename: ${basename}`,
              description: `The file "${basename}" matches known malicious or supply-chain attack filenames.`,
              file: file.filename,
              line: null,
              code: null,
              suggestion: "Review this file carefully. Remove it if it was not intentionally created.",
              category: "malicious",
            });
          }

          if (basename === "package.json") {
            try {
              const pkg = JSON.parse(file.content);
              const scripts = pkg.scripts || {};
              for (const hook of ["preinstall", "postinstall", "preuninstall"]) {
                if (scripts[hook]) {
                  const cmd = scripts[hook];
                  if (/curl\s|wget\s|node\s+-e|eval|bash\s+-c/.test(cmd)) {
                    malFindings.push({
                      severity: "critical",
                      title: `Suspicious ${hook} script in package.json`,
                      description: `The ${hook} script contains potentially dangerous commands: "${cmd.slice(0, 100)}"`,
                      file: file.filename,
                      line: null,
                      code: `"${hook}": "${cmd.slice(0, 150)}"`,
                      suggestion: "Review lifecycle scripts carefully. Malicious packages often use install hooks.",
                      category: "malicious",
                    });
                  }
                }
              }
            } catch {}
          }

          for (const sp of suspiciousPatterns) {
            const lines = file.content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              sp.pattern.lastIndex = 0;
              if (sp.pattern.test(lines[i])) {
                malFindings.push({
                  severity: sp.severity,
                  title: sp.title,
                  description: sp.description,
                  file: file.filename,
                  line: i + 1,
                  code: lines[i].trim().slice(0, 200),
                  suggestion: "Investigate this code carefully. It may be obfuscated malware.",
                  category: "malicious",
                });
                break;
              }
            }
          }
        }
        return malFindings;
      }

      const nodeAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "lodash": [{ severity: "high", vulnVersions: "<4.17.21", fixedVersion: "4.17.21", cve: "CVE-2021-23337", description: "Prototype Pollution in lodash via template function." }],
        "express": [{ severity: "medium", vulnVersions: "<4.19.2", fixedVersion: "4.19.2", cve: "CVE-2024-29041", description: "Open redirect vulnerability in express." }],
        "jquery": [{ severity: "medium", vulnVersions: "<3.5.0", fixedVersion: "3.5.0", cve: "CVE-2020-11022", description: "XSS vulnerability in jQuery.htmlPrefilter." }],
        "moment": [{ severity: "high", vulnVersions: "<2.29.4", fixedVersion: "2.29.4", cve: "CVE-2022-31129", description: "ReDoS vulnerability in moment.js." }],
        "minimist": [{ severity: "critical", vulnVersions: "<1.2.6", fixedVersion: "1.2.6", cve: "CVE-2021-44906", description: "Prototype Pollution in minimist." }],
        "node-fetch": [{ severity: "medium", vulnVersions: "<2.6.7", fixedVersion: "2.6.7", cve: "CVE-2022-0235", description: "Exposure of sensitive information in node-fetch." }],
        "axios": [{ severity: "high", vulnVersions: "<1.6.0", fixedVersion: "1.6.0", cve: "CVE-2023-45857", description: "CSRF/SSRF vulnerability in axios." }],
        "jsonwebtoken": [{ severity: "high", vulnVersions: "<9.0.0", fixedVersion: "9.0.0", cve: "CVE-2022-23529", description: "Insecure key handling in jsonwebtoken." }],
        "tar": [{ severity: "high", vulnVersions: "<6.1.9", fixedVersion: "6.1.9", cve: "CVE-2021-37713", description: "Arbitrary file creation/overwrite in tar." }],
        "glob-parent": [{ severity: "high", vulnVersions: "<5.1.2", fixedVersion: "5.1.2", cve: "CVE-2020-28469", description: "ReDoS vulnerability in glob-parent." }],
        "semver": [{ severity: "medium", vulnVersions: "<7.5.2", fixedVersion: "7.5.2", cve: "CVE-2022-25883", description: "ReDoS vulnerability in semver." }],
        "qs": [{ severity: "high", vulnVersions: "<6.10.3", fixedVersion: "6.10.3", cve: "CVE-2022-24999", description: "Prototype Pollution in qs." }],
        "path-parse": [{ severity: "medium", vulnVersions: "<1.0.7", fixedVersion: "1.0.7", cve: "CVE-2021-23343", description: "ReDoS vulnerability in path-parse." }],
        "underscore": [{ severity: "critical", vulnVersions: "<1.13.6", fixedVersion: "1.13.6", cve: "CVE-2021-23358", description: "Arbitrary Code Execution via template function." }],
        "ansi-regex": [{ severity: "high", vulnVersions: "<6.0.1", fixedVersion: "6.0.1", cve: "CVE-2021-3807", description: "ReDoS vulnerability in ansi-regex." }],
        "shell-quote": [{ severity: "critical", vulnVersions: "<1.7.3", fixedVersion: "1.7.3", cve: "CVE-2021-42740", description: "Command injection in shell-quote." }],
        "cross-fetch": [{ severity: "medium", vulnVersions: "<3.1.5", fixedVersion: "3.1.5", cve: "CVE-2022-1365", description: "Exposure of sensitive information." }],
        "xml2js": [{ severity: "medium", vulnVersions: "<0.5.0", fixedVersion: "0.5.0", cve: "CVE-2023-0842", description: "Prototype pollution in xml2js." }],
      };

      const pyAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "pyyaml": [{ severity: "critical", vulnVersions: "<6.0.1", fixedVersion: "6.0.1", cve: "CVE-2020-14343", description: "Arbitrary code execution via yaml.load()." }],
        "django": [{ severity: "high", vulnVersions: "<4.2.11", fixedVersion: "4.2.11", cve: "CVE-2024-27351", description: "ReDoS in django.utils.text.Truncator." }],
        "flask": [{ severity: "high", vulnVersions: "<2.3.2", fixedVersion: "2.3.2", cve: "CVE-2023-30861", description: "Session cookie security vulnerability." }],
        "jinja2": [{ severity: "high", vulnVersions: "<3.1.3", fixedVersion: "3.1.3", cve: "CVE-2024-22195", description: "XSS via xmlattr filter." }],
        "pillow": [{ severity: "high", vulnVersions: "<10.2.0", fixedVersion: "10.2.0", cve: "CVE-2023-50447", description: "Arbitrary code execution in PIL." }],
        "paramiko": [{ severity: "critical", vulnVersions: "<3.4.0", fixedVersion: "3.4.0", cve: "CVE-2023-48795", description: "Terrapin SSH prefix truncation attack." }],
        "requests": [{ severity: "medium", vulnVersions: "<2.31.0", fixedVersion: "2.31.0", cve: "CVE-2023-32681", description: "Proxy-Authorization header leak." }],
        "cryptography": [{ severity: "high", vulnVersions: "<41.0.6", fixedVersion: "41.0.6", cve: "CVE-2023-49083", description: "NULL dereference in PKCS12 parsing." }],
        "certifi": [{ severity: "medium", vulnVersions: "<2023.7.22", fixedVersion: "2023.7.22", cve: "CVE-2023-37920", description: "Removal of e-Tugra root certificate." }],
        "urllib3": [{ severity: "medium", vulnVersions: "<2.0.7", fixedVersion: "2.0.7", cve: "CVE-2023-45803", description: "Cookie leak on cross-origin redirect." }],
        "setuptools": [{ severity: "medium", vulnVersions: "<70.0.0", fixedVersion: "70.0.0", cve: "CVE-2024-6345", description: "Remote code execution via download functions." }],
        "werkzeug": [{ severity: "high", vulnVersions: "<3.0.3", fixedVersion: "3.0.3", cve: "CVE-2024-34069", description: "Debugger PIN bypass vulnerability." }],
      };

      const goAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "golang.org/x/crypto": [{ severity: "high", vulnVersions: "<0.17.0", fixedVersion: "0.17.0", cve: "CVE-2023-48795", description: "Terrapin attack in SSH." }],
        "golang.org/x/net": [{ severity: "high", vulnVersions: "<0.23.0", fixedVersion: "0.23.0", cve: "CVE-2023-45288", description: "HTTP/2 rapid reset attack." }],
        "golang.org/x/text": [{ severity: "high", vulnVersions: "<0.3.8", fixedVersion: "0.3.8", cve: "CVE-2022-32149", description: "DoS via crafted Accept-Language header." }],
        "github.com/gin-gonic/gin": [{ severity: "medium", vulnVersions: "<1.9.1", fixedVersion: "1.9.1", cve: "CVE-2023-29401", description: "Improper header handling." }],
      };

      const rustAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "hyper": [{ severity: "high", vulnVersions: "<0.14.27", fixedVersion: "0.14.27", cve: "CVE-2023-26964", description: "HTTP/2 rapid reset vulnerability." }],
        "tokio": [{ severity: "medium", vulnVersions: "<1.18.6", fixedVersion: "1.18.6", cve: "CVE-2023-22466", description: "Reject on drop can cause a double free." }],
        "regex": [{ severity: "medium", vulnVersions: "<1.8.1", fixedVersion: "1.8.1", cve: "CVE-2022-24713", description: "ReDoS vulnerability in regex crate." }],
      };

      const phpAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "guzzlehttp/guzzle": [{ severity: "high", vulnVersions: "<7.4.5", fixedVersion: "7.4.5", cve: "CVE-2022-31090", description: "CURLOPT_HTTPAUTH leak on redirect." }],
        "symfony/http-kernel": [{ severity: "critical", vulnVersions: "<6.3.5", fixedVersion: "6.3.5", cve: "CVE-2023-46734", description: "XSS via error handler." }],
        "laravel/framework": [{ severity: "high", vulnVersions: "<10.48.4", fixedVersion: "10.48.4", cve: "CVE-2024-29291", description: "SQL injection via route parameters." }],
      };

      const rubyAdvisoryDb: Record<string, { severity: string; vulnVersions: string; fixedVersion: string; cve: string; description: string }[]> = {
        "rails": [{ severity: "high", vulnVersions: "<7.0.8", fixedVersion: "7.0.8", cve: "CVE-2023-44487", description: "HTTP/2 DoS vulnerability." }],
        "nokogiri": [{ severity: "high", vulnVersions: "<1.16.2", fixedVersion: "1.16.2", cve: "CVE-2024-25062", description: "Use-after-free in libxml2." }],
        "rack": [{ severity: "critical", vulnVersions: "<3.0.9.1", fixedVersion: "3.0.9.1", cve: "CVE-2024-26146", description: "ReDoS in Accept header parsing." }],
      };

      function parseVersion(v: string): number[] {
        return v.replace(/^[^0-9]*/, "").split(".").map(n => parseInt(n) || 0);
      }

      function compareVersions(a: number[], b: number[]): number {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          const va = a[i] || 0;
          const vb = b[i] || 0;
          if (va < vb) return -1;
          if (va > vb) return 1;
        }
        return 0;
      }

      function isVulnerable(installedVersion: string, vulnRange: string): boolean {
        const installed = parseVersion(installedVersion);
        const match = vulnRange.match(/^<\s*(.+)$/);
        if (match) {
          const fixed = parseVersion(match[1]);
          return compareVersions(installed, fixed) < 0;
        }
        return false;
      }

      function scanNodeDeps(pkgFile: typeof projectFiles[0], lockFile: typeof projectFiles[0] | undefined): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const pkg = JSON.parse(pkgFile.content);
          const directDeps = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
          const allDeps: Record<string, string> = {};

          if (lockFile) {
            try {
              const lock = JSON.parse(lockFile.content);
              if (lock.packages) {
                for (const [path, info] of Object.entries(lock.packages as Record<string, any>)) {
                  const name = path.replace(/^node_modules\//, "");
                  if (name && info.version) allDeps[name] = info.version;
                }
              } else if (lock.dependencies) {
                for (const [name, info] of Object.entries(lock.dependencies as Record<string, any>)) {
                  if ((info as any).version) allDeps[name] = (info as any).version;
                }
              }
            } catch {}
          }

          const depsToCheck = { ...allDeps };
          for (const [name, ver] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>)) {
            if (!depsToCheck[name]) depsToCheck[name] = ver;
          }

          for (const [depName, advisories] of Object.entries(nodeAdvisoryDb)) {
            const version = depsToCheck[depName];
            if (!version) continue;
            const cleanVersion = version.replace(/^[\^~>=<\s]+/, "");
            const isDirect = directDeps.has(depName);
            for (const adv of advisories) {
              if (isVulnerable(cleanVersion, adv.vulnVersions)) {
                depFindings.push({
                  severity: adv.severity,
                  title: `${adv.cve}: ${depName}@${cleanVersion}`,
                  description: `${adv.description} Vulnerable versions: ${adv.vulnVersions}. ${isDirect ? "Direct dependency." : "Transitive dependency."}`,
                  file: lockFile ? lockFile.filename : pkgFile.filename,
                  line: null,
                  code: `"${depName}": "${version}" (installed: ${cleanVersion}, fix: >=${adv.fixedVersion})`,
                  suggestion: `Update ${depName} to >=${adv.fixedVersion}.`,
                  category: "dependency",
                  isDirect,
                });
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function scanPythonDeps(reqFile: typeof projectFiles[0]): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const lines = reqFile.content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith("#") || line.startsWith("-")) continue;
            const match = line.match(/^([a-zA-Z0-9_.-]+)\s*(?:==|>=|~=|<=|!=|<|>)?\s*([\d.]*)/);
            if (!match) continue;
            const pkgName = match[1].toLowerCase().replace(/-/g, "_").replace(/_/g, "-");
            const version = match[2] || "0.0.0";
            for (const [dep, advisories] of Object.entries(pyAdvisoryDb)) {
              const normalizedDep = dep.toLowerCase().replace(/-/g, "_").replace(/_/g, "-");
              const normalizedPkg = pkgName.replace(/-/g, "_").replace(/_/g, "-");
              if (normalizedPkg === normalizedDep || normalizedPkg === dep.toLowerCase()) {
                for (const adv of advisories) {
                  if (version === "0.0.0" || isVulnerable(version, adv.vulnVersions)) {
                    depFindings.push({
                      severity: adv.severity,
                      title: `${adv.cve}: ${pkgName}@${version || "unknown"}`,
                      description: `${adv.description} Vulnerable versions: ${adv.vulnVersions}.`,
                      file: reqFile.filename,
                      line: i + 1,
                      code: line,
                      suggestion: `Update ${pkgName} to >=${adv.fixedVersion}.`,
                      category: "dependency",
                      isDirect: true,
                    });
                  }
                }
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function scanGoModDeps(goSumFile: typeof projectFiles[0], goModFile: typeof projectFiles[0] | undefined): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const directModules = new Set<string>();
          if (goModFile) {
            const modLines = goModFile.content.split("\n");
            let inRequire = false;
            for (const ml of modLines) {
              if (ml.trim().startsWith("require")) inRequire = true;
              if (inRequire && ml.includes(")")) { inRequire = false; continue; }
              if (inRequire || ml.match(/^require\s/)) {
                const m = ml.match(/^\s*([^\s]+)\s+v?([\d.]+)/);
                if (m) directModules.add(m[1]);
              }
            }
          }

          const seenModules = new Set<string>();
          const lines = goSumFile.content.split("\n");
          for (const line of lines) {
            const match = line.match(/^([^\s]+)\s+v([\d.]+)/);
            if (!match) continue;
            const [, modPath, version] = match;
            if (seenModules.has(modPath)) continue;
            seenModules.add(modPath);
            for (const [dep, advisories] of Object.entries(goAdvisoryDb)) {
              if (modPath === dep || modPath.startsWith(dep + "/")) {
                const isDirect = directModules.has(modPath);
                for (const adv of advisories) {
                  if (isVulnerable(version, adv.vulnVersions)) {
                    depFindings.push({
                      severity: adv.severity,
                      title: `${adv.cve}: ${modPath}@${version}`,
                      description: `${adv.description} ${isDirect ? "Direct dependency." : "Transitive dependency."}`,
                      file: goSumFile.filename,
                      line: null,
                      code: `${modPath} v${version} (fix: >=${adv.fixedVersion})`,
                      suggestion: `Update ${modPath} to >=${adv.fixedVersion}.`,
                      category: "dependency",
                      isDirect,
                    });
                  }
                }
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function scanCargoLockDeps(cargoLock: typeof projectFiles[0], cargoToml: typeof projectFiles[0] | undefined): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const directDeps = new Set<string>();
          if (cargoToml) {
            const tomlLines = cargoToml.content.split("\n");
            let inDeps = false;
            for (const tl of tomlLines) {
              if (tl.match(/^\[dependencies\]/)) inDeps = true;
              else if (tl.match(/^\[/)) inDeps = false;
              if (inDeps) {
                const m = tl.match(/^([a-zA-Z0-9_-]+)\s*=/);
                if (m) directDeps.add(m[1]);
              }
            }
          }

          const packageBlocks = cargoLock.content.split(/\n\[\[package\]\]\n/);
          for (const block of packageBlocks) {
            const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
            const versionMatch = block.match(/version\s*=\s*"([^"]+)"/);
            if (!nameMatch || !versionMatch) continue;
            const name = nameMatch[1];
            const version = versionMatch[1];
            for (const [dep, advisories] of Object.entries(rustAdvisoryDb)) {
              if (name === dep) {
                const isDirect = directDeps.has(name);
                for (const adv of advisories) {
                  if (isVulnerable(version, adv.vulnVersions)) {
                    depFindings.push({
                      severity: adv.severity,
                      title: `${adv.cve}: ${name}@${version}`,
                      description: `${adv.description} ${isDirect ? "Direct dependency." : "Transitive dependency."}`,
                      file: cargoLock.filename,
                      line: null,
                      code: `${name} = "${version}" (fix: >=${adv.fixedVersion})`,
                      suggestion: `Update ${name} to >=${adv.fixedVersion}.`,
                      category: "dependency",
                      isDirect,
                    });
                  }
                }
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function scanComposerLockDeps(composerLock: typeof projectFiles[0], composerJson: typeof projectFiles[0] | undefined): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const directDeps = new Set<string>();
          if (composerJson) {
            try {
              const cj = JSON.parse(composerJson.content);
              for (const name of Object.keys(cj.require || {})) directDeps.add(name);
            } catch {}
          }
          const lock = JSON.parse(composerLock.content);
          const packages = [...(lock.packages || []), ...(lock["packages-dev"] || [])];
          for (const pkg of packages) {
            if (!pkg.name || !pkg.version) continue;
            const version = pkg.version.replace(/^v/, "");
            for (const [dep, advisories] of Object.entries(phpAdvisoryDb)) {
              if (pkg.name === dep) {
                const isDirect = directDeps.has(dep);
                for (const adv of advisories) {
                  if (isVulnerable(version, adv.vulnVersions)) {
                    depFindings.push({
                      severity: adv.severity,
                      title: `${adv.cve}: ${pkg.name}@${version}`,
                      description: `${adv.description} ${isDirect ? "Direct dependency." : "Transitive dependency."}`,
                      file: composerLock.filename,
                      line: null,
                      code: `"${pkg.name}": "${version}" (fix: >=${adv.fixedVersion})`,
                      suggestion: `Update ${pkg.name} to >=${adv.fixedVersion}.`,
                      category: "dependency",
                      isDirect,
                    });
                  }
                }
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function scanGemfileLockDeps(gemfileLock: typeof projectFiles[0]): FindingEntry[] {
        const depFindings: FindingEntry[] = [];
        try {
          const lines = gemfileLock.content.split("\n");
          let inSpecs = false;
          for (const line of lines) {
            if (line.trim() === "specs:") { inSpecs = true; continue; }
            if (!line.startsWith("    ") && inSpecs) { inSpecs = false; continue; }
            if (inSpecs) {
              const match = line.match(/^\s{4}([a-zA-Z0-9_-]+)\s+\(([\d.]+)\)/);
              if (match) {
                const [, name, version] = match;
                for (const [dep, advisories] of Object.entries(rubyAdvisoryDb)) {
                  if (name === dep) {
                    for (const adv of advisories) {
                      if (isVulnerable(version, adv.vulnVersions)) {
                        depFindings.push({
                          severity: adv.severity,
                          title: `${adv.cve}: ${name}@${version}`,
                          description: adv.description,
                          file: gemfileLock.filename,
                          line: null,
                          code: `${name} (${version}) (fix: >=${adv.fixedVersion})`,
                          suggestion: `Update ${name} to >=${adv.fixedVersion}.`,
                          category: "dependency",
                          isDirect: null,
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {}
        return depFindings;
      }

      function runAstAnalysis(content: string, filename: string): FindingEntry[] {
        const astFindings: FindingEntry[] = [];
        try {
          const acorn = require("acorn");
          const walk = require("acorn-walk");

          let parseContent = content;
          if (filename.endsWith(".ts") || filename.endsWith(".tsx")) {
            parseContent = content
              .replace(/:\s*\w[\w<>\[\]|&,\s]*(?=[;=,\)\}\]\n])/g, "")
              .replace(/\bas\s+\w+/g, "")
              .replace(/<\w+(?:\s+extends\s+\w+)?>/g, "");
          }

          let ast: any;
          try {
            ast = acorn.parse(parseContent, {
              ecmaVersion: "latest",
              sourceType: "module",
              locations: true,
              allowImportExportEverywhere: true,
              allowReturnOutsideFunction: true,
              allowHashBang: true,
            });
          } catch {
            return astFindings;
          }

          walk.simple(ast, {
            CallExpression(node: any) {
              const callee = node.callee;
              if (callee.type === "Identifier" && callee.name === "eval") {
                astFindings.push({
                  severity: "critical",
                  title: "Use of eval() (AST detected)",
                  description: "eval() executes arbitrary code. Detected via AST analysis of the call expression.",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Use JSON.parse() for JSON data, or a safe alternative to eval().",
                  category: "sast",
                });
              }

              if (callee.type === "Identifier" && callee.name === "setTimeout" || callee.name === "setInterval") {
                if (node.arguments.length > 0 && node.arguments[0].type === "Literal" && typeof node.arguments[0].value === "string") {
                  astFindings.push({
                    severity: "high",
                    title: `String argument to ${callee.name}() (AST detected)`,
                    description: `Passing a string to ${callee.name}() is equivalent to eval() and can execute arbitrary code.`,
                    file: filename,
                    line: node.loc?.start?.line ?? null,
                    code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                    suggestion: "Pass a function reference instead of a string.",
                    category: "sast",
                  });
                }
              }

              if (callee.type === "MemberExpression") {
                const obj = callee.object;
                const prop = callee.property;

                if (obj.type === "Identifier" && obj.name === "child_process" ||
                    (prop.type === "Identifier" && (prop.name === "exec" || prop.name === "execSync") &&
                     obj.type === "Identifier" && obj.name !== "RegExp")) {
                  const hasTemplateOrConcat = node.arguments.some((arg: any) =>
                    arg.type === "TemplateLiteral" || arg.type === "BinaryExpression"
                  );
                  if (hasTemplateOrConcat) {
                    astFindings.push({
                      severity: "critical",
                      title: "Command injection risk (AST detected)",
                      description: "Dynamic string passed to command execution function detected via AST analysis.",
                      file: filename,
                      line: node.loc?.start?.line ?? null,
                      code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                      suggestion: "Use execFile() with an argument array, or sanitize inputs.",
                      category: "sast",
                    });
                  }
                }
              }
            },

            NewExpression(node: any) {
              if (node.callee.type === "Identifier" && node.callee.name === "Function") {
                astFindings.push({
                  severity: "high",
                  title: "Dynamic Function constructor (AST detected)",
                  description: "The Function constructor creates functions from strings, similar to eval().",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Avoid dynamic code generation; use static functions instead.",
                  category: "sast",
                });
              }
            },

            AssignmentExpression(node: any) {
              if (node.left.type === "MemberExpression" && node.left.property.type === "Identifier") {
                if (node.left.property.name === "innerHTML" || node.left.property.name === "outerHTML") {
                  const hasUserInput = node.right.type === "TemplateLiteral" ||
                    node.right.type === "BinaryExpression" ||
                    (node.right.type === "Identifier" && !["''", '""', "``"].includes(node.right.name));
                  if (hasUserInput) {
                    astFindings.push({
                      severity: "high",
                      title: `Dynamic ${node.left.property.name} assignment (AST detected)`,
                      description: `Setting ${node.left.property.name} with dynamic content can lead to XSS attacks.`,
                      file: filename,
                      line: node.loc?.start?.line ?? null,
                      code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                      suggestion: "Use textContent or sanitize with DOMPurify.",
                      category: "sast",
                    });
                  }
                }
              }
            },

            ImportDeclaration(node: any) {
              if (node.source.value === "child_process") {
                astFindings.push({
                  severity: "medium",
                  title: "child_process import (AST detected)",
                  description: "Importing child_process can lead to command injection if not used carefully.",
                  file: filename,
                  line: node.loc?.start?.line ?? null,
                  code: content.split("\n")[(node.loc?.start?.line ?? 1) - 1]?.trim().slice(0, 200) ?? null,
                  suggestion: "Ensure all child_process usage validates and sanitizes inputs.",
                  category: "sast",
                });
              }
            },
          });
        } catch {}
        return astFindings;
      }

      const allSupportedExts = ["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "mjs", "cjs", "go", "rs", "php", "rb", "java", "c", "cpp", "cc", "cxx", "h", "hpp"];

      for (const file of projectFiles) {
        if (checkTimeout()) break;
        const ext = file.filename.split(".").pop()?.toLowerCase();
        if (!ext || !allSupportedExts.includes(ext)) continue;
        if (file.content.length > 512 * 1024) continue;

        const isJsLike = ["js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext);
        const isPython = ext === "py";
        const isGo = ext === "go";
        const isRust = ext === "rs";
        const isPhp = ext === "php";
        const isRuby = ext === "rb";
        const isJava = ext === "java";
        const isCpp = ["c", "cpp", "cc", "cxx", "h", "hpp"].includes(ext);

        if (isJsLike) {
          const astResults = runAstAnalysis(file.content, file.filename);
          findings.push(...astResults);
        }

        if (isJsLike || isPython) {
          const privacyResults = runPrivacyScan(file.content, file.filename);
          findings.push(...privacyResults);
        }

        let patternsToUse = [...regexPatterns];
        if (isPython) patternsToUse = [...regexPatterns, ...pythonRegexPatterns];
        else if (isGo) patternsToUse = [...regexPatterns.slice(0, 3), ...goRegexPatterns];
        else if (isRust) patternsToUse = [...regexPatterns.slice(0, 3), ...rustRegexPatterns];
        else if (isPhp) patternsToUse = [...regexPatterns.slice(0, 3), ...phpRegexPatterns];
        else if (isRuby) patternsToUse = [...regexPatterns.slice(0, 3), ...rubyRegexPatterns];
        else if (isJava) patternsToUse = [...regexPatterns.slice(0, 3), ...javaRegexPatterns];
        else if (isCpp) patternsToUse = [...regexPatterns.slice(0, 3), ...cppRegexPatterns];

        const lines = file.content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const rule of patternsToUse) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(line)) {
              const isDuplicate = isJsLike && findings.some(f =>
                f.file === file.filename && f.line === i + 1 && f.title.replace(" (AST detected)", "") === rule.title
              );
              if (!isDuplicate) {
                findings.push({
                  severity: rule.severity,
                  title: rule.title,
                  description: rule.description,
                  file: file.filename,
                  line: i + 1,
                  code: line.trim().slice(0, 200),
                  suggestion: rule.suggestion,
                  category: "sast",
                });
              }
            }
          }
        }
      }

      if (!checkTimeout()) {
        const maliciousResults = runMaliciousFileScan(projectFiles);
        findings.push(...maliciousResults);
      }

      const packageJson = projectFiles.find(f => f.filename === "package.json");
      const packageLock = projectFiles.find(f => f.filename === "package-lock.json");
      if (packageJson && !checkTimeout()) {
        findings.push(...scanNodeDeps(packageJson, packageLock));

        if (!checkTimeout()) {
          const wsDir = path.join(process.cwd(), 'project-workspaces', String(projectId).replace(/[^a-zA-Z0-9_-]/g, '_'));
          try {
            const fsMod = await import("fs");
            if (fsMod.existsSync(path.join(wsDir, 'node_modules')) && fsMod.existsSync(path.join(wsDir, 'package.json'))) {
              const { spawn } = await import("child_process");
              const auditTimeoutMs = Math.min(8000, SCAN_TIMEOUT_MS - (Date.now() - scanStartTime) - 2000);
              if (auditTimeoutMs > 2000) {
                const auditFindings = await new Promise<FindingEntry[]>((resolve) => {
                  let stdout = '';
                  let resolved = false;
                  const child = spawn('npm', ['audit', '--json', '--production'], { cwd: wsDir, shell: false, env: { ...process.env, HOME: wsDir }, timeout: auditTimeoutMs });
                  const timer = setTimeout(() => { if (!resolved) { resolved = true; try { child.kill('SIGKILL'); } catch {} resolve([]); } }, auditTimeoutMs);
                  child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); if (stdout.length > 1024 * 1024) { resolved = true; clearTimeout(timer); try { child.kill('SIGKILL'); } catch {} resolve([]); } });
                  child.on('close', () => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timer);
                    try {
                      const audit = JSON.parse(stdout);
                      const results: FindingEntry[] = [];
                      const vulns = audit.vulnerabilities || {};
                      for (const [pkgName, info] of Object.entries(vulns) as [string, any][]) {
                        const sev = info.severity || 'medium';
                        const via = Array.isArray(info.via) ? info.via.filter((v: any) => typeof v === 'object') : [];
                        const firstCve = via[0]?.url || '';
                        const desc = via[0]?.title || `Vulnerability in ${pkgName}`;
                        const isDirect = info.isDirect || false;
                        const existing = findings.find(f => f.title.includes(pkgName) && f.category === 'dependency');
                        if (!existing) {
                          results.push({
                            severity: sev,
                            title: `npm audit: ${pkgName}@${info.range || 'unknown'}`,
                            description: `${desc}${firstCve ? ` (${firstCve})` : ''}. ${isDirect ? 'Direct dependency.' : 'Transitive dependency.'}`,
                            file: 'package.json',
                            line: null,
                            code: `${pkgName}: ${info.range || 'unknown'} → fix: ${info.fixAvailable ? JSON.stringify(info.fixAvailable).slice(0, 100) : 'no fix available'}`,
                            suggestion: info.fixAvailable ? `Run: npm audit fix` : `Review and manually update ${pkgName}.`,
                            category: 'dependency',
                            isDirect,
                          });
                        }
                      }
                      resolve(results);
                    } catch { resolve([]); }
                  });
                  child.on('error', () => { if (!resolved) { resolved = true; clearTimeout(timer); resolve([]); } });
                });
                findings.push(...auditFindings);
                log(`npm audit found ${auditFindings.length} additional vulnerabilities for project ${projectId}`, "security");
              }
            }
          } catch (auditErr: any) {
            log(`npm audit skipped: ${auditErr.message}`, "security");
          }
        }
      }

      if (!checkTimeout()) {
        const requirementsTxt = projectFiles.find(f => f.filename === "requirements.txt" || f.filename === "Pipfile");
        if (requirementsTxt) findings.push(...scanPythonDeps(requirementsTxt));
      }

      if (!checkTimeout()) {
        const goSum = projectFiles.find(f => f.filename === "go.sum");
        const goMod = projectFiles.find(f => f.filename === "go.mod");
        if (goSum) findings.push(...scanGoModDeps(goSum, goMod));
      }

      if (!checkTimeout()) {
        const cargoLock = projectFiles.find(f => f.filename === "Cargo.lock");
        const cargoToml = projectFiles.find(f => f.filename === "Cargo.toml");
        if (cargoLock) findings.push(...scanCargoLockDeps(cargoLock, cargoToml));
      }

      if (!checkTimeout()) {
        const composerLock = projectFiles.find(f => f.filename === "composer.lock");
        const composerJson = projectFiles.find(f => f.filename === "composer.json");
        if (composerLock) findings.push(...scanComposerLockDeps(composerLock, composerJson));
      }

      if (!checkTimeout()) {
        const gemfileLock = projectFiles.find(f => f.filename === "Gemfile.lock");
        if (gemfileLock) findings.push(...scanGemfileLockDeps(gemfileLock));
      }

      const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      for (const f of findings) {
        if (f.severity in counts) counts[f.severity as keyof typeof counts]++;
      }

      if (findings.length > 0) {
        await storage.createSecurityFindings(findings.map(f => ({
          scanId: scan.id,
          severity: f.severity,
          title: f.title,
          description: f.description,
          file: f.file,
          line: f.line,
          code: f.code,
          suggestion: f.suggestion,
          category: f.category || "sast",
          isDirect: f.isDirect ?? null,
        })));
      }

      const updated = await storage.updateSecurityScan(scan.id, {
        status: "completed",
        totalFindings: findings.length,
        ...counts,
        finishedAt: new Date(),
      });

      if (timedOut) {
        log(`Security scan timed out for project ${projectId} after ${Date.now() - scanStartTime}ms, returning ${findings.length} partial findings`, "security");
      }

      res.json({ ...updated, timedOut, scanDuration: Date.now() - scanStartTime });
    } catch (err: any) {
      log(`Security scan error: ${err.message}`, "security");
      res.status(500).json({ message: "Scan failed: " + (err.message || "Unknown error") });
    }
  });

  app.get("/api/projects/:id/security/scans", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const scans = await storage.getProjectScans(req.params.id);
      res.json(scans);
    } catch {
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  app.get("/api/projects/:id/security/scans/:scanId/findings", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!await verifyProjectAccess(req.params.id, req.session.userId!)) return res.status(403).json({ message: "Access denied" });
      const scan = (await storage.getProjectScans(req.params.id)).find(s => s.id === req.params.scanId);
      if (!scan) return res.status(404).json({ message: "Scan not found in this project" });
      const hidden = qstr(req.query.hidden) === "true" ? true : qstr(req.query.hidden) === "false" ? false : undefined;
      const findings = await storage.getScanFindings(req.params.scanId, hidden);
      res.json(findings);
    } catch {
      res.status(500).json({ message: "Failed to fetch findings" });
    }
  });

  async function verifyFindingAccess(findingId: string, userId: string): Promise<boolean> {
    const { pool } = await import("./db");
    const result = await pool.query(
      `SELECT sf.scan_id, ss.project_id FROM security_findings sf
       JOIN security_scans ss ON ss.id = sf.scan_id
       WHERE sf.id = $1 LIMIT 1`,
      [findingId]
    );
    if (result.rows.length === 0) return false;
    return verifyProjectAccess(result.rows[0].project_id, userId);
  }

  app.patch("/api/security/findings/:findingId/hide", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const hasAccess = await verifyFindingAccess(req.params.findingId, userId);
      if (!hasAccess) return res.status(403).json({ message: "Access denied" });
      const finding = await storage.hideSecurityFinding(req.params.findingId);
      if (!finding) return res.status(404).json({ message: "Finding not found" });
      res.json(finding);
    } catch {
      res.status(500).json({ message: "Failed to hide finding" });
    }
  });

  app.patch("/api/security/findings/:findingId/unhide", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const hasAccess = await verifyFindingAccess(req.params.findingId, userId);
      if (!hasAccess) return res.status(403).json({ message: "Access denied" });
      const finding = await storage.unhideSecurityFinding(req.params.findingId);
      if (!finding) return res.status(404).json({ message: "Finding not found" });
      res.json(finding);
    } catch {
      res.status(500).json({ message: "Failed to unhide finding" });
    }
  });

  app.patch("/api/security/findings/:findingId/agent-session", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const hasAccess = await verifyFindingAccess(req.params.findingId, userId);
      if (!hasAccess) return res.status(403).json({ message: "Access denied" });
      const { agentSessionId } = req.body;
      if (!agentSessionId) return res.status(400).json({ message: "agentSessionId is required" });
      const finding = await storage.setFindingAgentSession(req.params.findingId, agentSessionId);
      if (!finding) return res.status(404).json({ message: "Finding not found" });
      res.json(finding);
    } catch {
      res.status(500).json({ message: "Failed to set agent session" });
    }
  });

  app.post("/api/projects/:id/security/auto-update", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId!;
      if (!await verifyProjectWriteAccess(projectId, userId)) return res.status(403).json({ message: "Access denied" });

      const { packageName, targetVersion } = req.body;
      if (!packageName || !targetVersion) return res.status(400).json({ message: "packageName and targetVersion are required" });

      const files = await storage.getFiles(projectId);
      const pkgJsonFile = files.find(f => f.filename === "package.json");
      if (!pkgJsonFile) return res.status(404).json({ message: "package.json not found" });

      try {
        const pkg = JSON.parse(pkgJsonFile.content);
        let updated = false;
        if (pkg.dependencies && pkg.dependencies[packageName]) {
          pkg.dependencies[packageName] = `^${targetVersion}`;
          updated = true;
        }
        if (pkg.devDependencies && pkg.devDependencies[packageName]) {
          pkg.devDependencies[packageName] = `^${targetVersion}`;
          updated = true;
        }
        if (!updated) return res.status(404).json({ message: `Package ${packageName} not found in dependencies` });

        await storage.updateFileContent(pkgJsonFile.id, JSON.stringify(pkg, null, 2));
        res.json({ success: true, message: `Updated ${packageName} to ^${targetVersion}. Re-scan to verify.` });
      } catch {
        res.status(500).json({ message: "Failed to update package.json" });
      }
    } catch (err: any) {
      res.status(500).json({ message: "Auto-update failed" });
    }
  });

}
