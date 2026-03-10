import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export async function listUserRepos(): Promise<any[]> {
  try {
    const response = await connectors.proxy("github", "/user/repos?sort=updated&per_page=20", {
      method: "GET",
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function getRepo(owner: string, repo: string): Promise<any> {
  const response = await connectors.proxy("github", `/repos/${owner}/${repo}`, {
    method: "GET",
  });
  if (!response.ok) throw new Error(`Failed to fetch repo: ${response.status}`);
  return response.json();
}

export async function getRepoContents(owner: string, repo: string, path: string = ""): Promise<any[]> {
  const response = await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
    method: "GET",
  });
  if (!response.ok) throw new Error(`Failed to fetch contents: ${response.status}`);
  return response.json();
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<string> {
  const response = await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
    method: "GET",
    headers: { Accept: "application/vnd.github.raw" },
  });
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  return response.text();
}

export async function createRepo(name: string, description: string = "", isPrivate: boolean = false): Promise<any> {
  const response = await connectors.proxy("github", "/user/repos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || `Failed to create repo: ${response.status}`);
  }
  return response.json();
}

export async function pushFile(
  owner: string, repo: string, path: string, content: string, message: string, sha?: string
): Promise<any> {
  const body: any = {
    message,
    content: Buffer.from(content).toString("base64"),
  };
  if (sha) body.sha = sha;
  const response = await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || `Failed to push file: ${response.status}`);
  }
  return response.json();
}

export async function getAuthenticatedUser(): Promise<any> {
  try {
    const response = await connectors.proxy("github", "/user", { method: "GET" });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
