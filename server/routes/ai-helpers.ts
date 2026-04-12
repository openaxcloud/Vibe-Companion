import { posix as pathPosix } from "path";
import { AGENT_MODE_MODELS, TOP_AGENT_MODE_MODELS, TOP_AGENT_MODE_CONFIG, type AgentMode, type TopAgentMode, type AutonomousTier } from "@shared/schema";

function sanitizePath(p: string): string | null {
  if (!p || typeof p !== "string") return null;
  const decoded = decodeURIComponent(p);
  if (decoded.includes("..") || decoded.includes("\\")) return null;
  if (p.includes("..") || p.includes("\\")) return null;
  const normalized = pathPosix.normalize(decoded).replace(/^\/+/, "");
  if (normalized.includes("..") || !normalized || normalized.startsWith("/")) return null;
  return normalized;
}

export const MAX_AGENT_ITERATIONS = 10;
export const MAX_PROMPT_LENGTH = 50000;
export const MAX_GENERATED_FILES = parseInt(process.env.MAX_GENERATED_FILES || "30", 10);
export const MAX_MESSAGE_CONTENT_LENGTH = 100000;
export const MAX_MESSAGES_COUNT = 50;
export const MAX_AI_FILENAME_LENGTH = 255;

export const FORBIDDEN_FILENAME_PATTERNS = [
  /\.\./,
  /\\/,
  /^\/+/,
  /[\x00-\x1f\x7f]/,
  /^\.+$/,
  /[<>:"|?*]/,
  /^\s|\s$/,
  /\.(env|pem|key|crt|cer|p12|pfx|jks)$/i,
  /^\.git\//,
  /^\.ssh\//,
  /^node_modules\//,
  /^__pycache__\//,
];

export function sanitizeAIFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") return null;
  if (filename.length > MAX_AI_FILENAME_LENGTH) return null;

  const trimmed = filename.trim();
  if (!trimmed) return null;

  for (const pattern of FORBIDDEN_FILENAME_PATTERNS) {
    if (pattern.test(trimmed)) return null;
  }

  const sanitized = sanitizePath(trimmed);
  if (!sanitized) return null;

  const parts = sanitized.split("/");
  for (const part of parts) {
    if (part.startsWith(".") && part !== ".gitignore" && part !== ".eslintrc" && part !== ".prettierrc") {
      return null;
    }
  }

  return sanitized;
}

export function validateAIMessages(messages: any[]): string | null {
  if (!Array.isArray(messages)) return "messages must be an array";
  if (messages.length === 0) return "messages array cannot be empty";
  if (messages.length > MAX_MESSAGES_COUNT) return `Too many messages (max ${MAX_MESSAGES_COUNT})`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== "object") return `Invalid message at index ${i}`;
    if (!msg.role || !["user", "assistant"].includes(msg.role)) {
      return `Invalid role at message index ${i}`;
    }
    if (typeof msg.content !== "string") return `Message content must be a string at index ${i}`;
    if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return `Message at index ${i} exceeds maximum length (${MAX_MESSAGE_CONTENT_LENGTH} chars)`;
    }
  }
  return null;
}

export function resolveTopAgentMode(body: any, userPlan: string): { modelId: string; maxTokens: number; effectiveAgentMode: AgentMode; systemPromptPrefix: string } {
  const topMode: TopAgentMode = (body.topAgentMode && ["lite", "autonomous", "max"].includes(body.topAgentMode)) ? body.topAgentMode : "autonomous";
  const tier: AutonomousTier = (body.autonomousTier && ["economy", "power"].includes(body.autonomousTier)) ? body.autonomousTier : "economy";
  const turbo = body.turbo === true;
  const selectedModel = body.model || "claude";

  let effectiveAgentMode: AgentMode;
  let modelId: string;
  let maxTokens: number;
  let systemPromptPrefix = "";

  if (topMode === "lite") {
    effectiveAgentMode = "economy";
    modelId = TOP_AGENT_MODE_MODELS.lite[selectedModel] || TOP_AGENT_MODE_MODELS.lite.claude;
    maxTokens = TOP_AGENT_MODE_CONFIG.lite.maxTokens;
    systemPromptPrefix = "You are in Lite mode. Make quick, targeted changes only. Skip planning — go straight to implementation.\n\n";
  } else if (topMode === "max") {
    effectiveAgentMode = turbo ? "turbo" : "power";
    modelId = TOP_AGENT_MODE_MODELS.max[selectedModel] || TOP_AGENT_MODE_MODELS.max.claude;
    maxTokens = TOP_AGENT_MODE_CONFIG.max.maxTokens;
    systemPromptPrefix = "You are in Max mode with extended context. Provide thorough, multi-step solutions with detailed explanations.\n\n";
  } else {
    effectiveAgentMode = turbo ? "turbo" : tier;
    modelId = (turbo ? AGENT_MODE_MODELS.turbo : AGENT_MODE_MODELS[tier])?.[selectedModel] || AGENT_MODE_MODELS.economy[selectedModel] || "claude-sonnet-4-6";
    maxTokens = turbo ? 16384 : (tier === "power" ? 16384 : 16384);
  }

  if (effectiveAgentMode === "turbo" && (userPlan === "free" || !userPlan)) {
    effectiveAgentMode = "power";
    modelId = AGENT_MODE_MODELS.power[selectedModel] || "claude-sonnet-4-6";
    maxTokens = topMode === "max" ? TOP_AGENT_MODE_CONFIG.max.maxTokens : 16384;
  }

  return { modelId, maxTokens, effectiveAgentMode, systemPromptPrefix };
}

export function sanitizeAIFileContent(content: string): string {
  if (typeof content !== "string") return "";
  const maxFileSize = 500000;
  if (content.length > maxFileSize) {
    content = content.slice(0, maxFileSize);
  }
  if (!content.includes('\n') && content.includes('\\n')) {
    content = content
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');
  }
  return content;
}
