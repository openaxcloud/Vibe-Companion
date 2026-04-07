export interface FileSection {
  title: string;
  content: string;
}

export interface FileGenerationInput {
  type: string;
  name: string;
  sections?: FileSection[];
  template?: string;
}

export async function generateFile(input: FileGenerationInput): Promise<{ content: string; mimeType: string }> {
  const content = input.sections
    ? input.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")
    : `# ${input.name}\n\nGenerated file.`;
  return { content, mimeType: getMimeType(input.name) };
}

export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    json: "application/json",
    md: "text/markdown",
    txt: "text/plain",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
