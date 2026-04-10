export class GitManager {
  async init(projectPath: string) {}
  async commit(projectPath: string, message: string) { return { hash: '' }; }
  async push(projectPath: string) {}
  async pull(projectPath: string) {}
  async status(projectPath: string) { return { modified: [], added: [], deleted: [] }; }
  async diff(projectPath: string) { return ''; }
}
export const gitManager = new GitManager();
