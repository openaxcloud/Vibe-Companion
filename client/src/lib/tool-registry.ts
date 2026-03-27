export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  enabled?: boolean;
}

export type ToolDefinition = ToolMetadata;

export const TOOL_REGISTRY: ToolMetadata[] = [];

export function getRegisteredTools(): ToolMetadata[] {
  return TOOL_REGISTRY;
}

export function getAllCategories(): string[] {
  return [...new Set(TOOL_REGISTRY.map(t => t.category))];
}

export function getToolsByCategory(): Record<string, ToolMetadata[]> {
  return {};
}

export function getToolById(id: string): ToolMetadata | undefined {
  return TOOL_REGISTRY.find(t => t.id === id);
}
