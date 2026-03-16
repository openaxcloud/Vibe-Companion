import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
const proxyFetch = connectors.createProxyFetch("github");

export function createGitHttpTransport() {
  return {
    async request({
      url,
      method,
      headers,
      body,
    }: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: AsyncIterableIterator<Uint8Array>;
    }) {
      let bodyBuffer: Buffer | undefined;
      if (body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of body) {
          chunks.push(chunk);
        }
        bodyBuffer = Buffer.concat(chunks);
      }

      const res = await proxyFetch(url, {
        method,
        headers,
        body: bodyBuffer,
      });

      const responseBody = new Uint8Array(await res.arrayBuffer());
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      return {
        url: res.url || url,
        method,
        statusCode: res.status,
        statusMessage: res.statusText,
        headers: responseHeaders,
        body: [responseBody],
      };
    },
  };
}

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

export async function getRepoTree(owner: string, repo: string, branch: string = "main"): Promise<{ tree: any[]; truncated: boolean }> {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, {
      method: "GET",
    });
    if (!response.ok) return { tree: [], truncated: false };
    const data = await response.json();
    const blobs = (data.tree || []).filter((item: any) => item.type === "blob");
    return { tree: blobs, truncated: !!data.truncated };
  } catch {
    return { tree: [], truncated: false };
  }
}

export async function getRepoTreePaginated(owner: string, repo: string, branch: string = "main", maxFiles: number = 5000): Promise<{ tree: any[]; truncated: boolean }> {
  const result = await getRepoTree(owner, repo, branch);
  if (!result.truncated || result.tree.length >= maxFiles) {
    return { tree: result.tree.slice(0, maxFiles), truncated: result.truncated || result.tree.length > maxFiles };
  }

  try {
    const topLevel = await getRepoContents(owner, repo);
    const allBlobs: any[] = [...result.tree];
    const seen = new Set(allBlobs.map((b: any) => b.path));

    const fetchSubtree = async (dirPath: string) => {
      try {
        const subResponse = await connectors.proxy("github", `/repos/${owner}/${repo}/git/trees/${branch}:${dirPath}?recursive=1`, {
          method: "GET",
        });
        if (subResponse.ok) {
          const subData = await subResponse.json();
          for (const sub of (subData.tree || [])) {
            if (sub.type === "blob" && !seen.has(`${dirPath}/${sub.path}`)) {
              allBlobs.push({ ...sub, path: `${dirPath}/${sub.path}` });
              seen.add(`${dirPath}/${sub.path}`);
            }
          }
        }
      } catch {}
    };

    const dirItems = topLevel.filter((item: any) => item.type === "dir");
    const SUBTREE_BATCH = 5;
    for (let i = 0; i < dirItems.length && allBlobs.length < maxFiles; i += SUBTREE_BATCH) {
      const batch = dirItems.slice(i, i + SUBTREE_BATCH);
      await Promise.allSettled(batch.map((item: any) => fetchSubtree(item.path)));
    }

    return { tree: allBlobs.slice(0, maxFiles), truncated: allBlobs.length >= maxFiles };
  } catch {
    return result;
  }
}

export async function getRepoBranches(owner: string, repo: string): Promise<any[]> {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/branches`, {
      method: "GET",
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function getLatestCommit(owner: string, repo: string, branch: string = "main"): Promise<any> {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/commits/${branch}`, {
      method: "GET",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function getRepoCommits(owner: string, repo: string, branch: string = "main", perPage: number = 20): Promise<Array<{ sha: string; commit: { message: string; author: { name: string; email: string; date: string } } }>> {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}`, {
      method: "GET",
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export async function deleteRepoFile(owner: string, repo: string, path: string, sha: string, message: string): Promise<void> {
  await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha }),
  });
}

export async function getRepoFileSha(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
      method: "GET",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.sha || null;
  } catch {
    return null;
  }
}
