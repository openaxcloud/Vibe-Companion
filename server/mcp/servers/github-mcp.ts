import { Octokit } from '@octokit/rest';
import { createLogger } from '../../utils/logger';

const logger = createLogger('github-mcp');

export interface GitHubMCPConfig {
  token?: string;
  baseUrl?: string;
}

export class GitHubMCPServer {
  private octokit: Octokit;

  constructor(config: GitHubMCPConfig = {}) {
    this.octokit = new Octokit({
      auth: config.token || process.env.GITHUB_TOKEN,
      baseUrl: config.baseUrl || 'https://api.github.com'
    });
  }

  // Repository operations
  async listRepos(username: string) {
    try {
      const { data } = await this.octokit.repos.listForUser({ username });
      return data.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language,
        private: repo.private,
        fork: repo.fork,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      logger.error('Failed to list repositories:', error);
      throw error;
    }
  }

  async createRepo(name: string, description?: string, isPrivate: boolean = false) {
    try {
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true
      });
      return {
        name: data.name,
        fullName: data.full_name,
        url: data.html_url,
        cloneUrl: data.clone_url
      };
    } catch (error) {
      logger.error('Failed to create repository:', error);
      throw error;
    }
  }

  async deleteRepo(owner: string, repo: string) {
    try {
      await this.octokit.repos.delete({ owner, repo });
      return { success: true, message: `Repository ${owner}/${repo} deleted` };
    } catch (error) {
      logger.error('Failed to delete repository:', error);
      throw error;
    }
  }

  // File operations
  async getFileContent(owner: string, repo: string, path: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path
      });
      
      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
          path: data.path,
          content,
          sha: data.sha,
          size: data.size
        };
      }
      throw new Error('Not a file');
    } catch (error) {
      logger.error('Failed to get file content:', error);
      throw error;
    }
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    try {
      const encodedContent = Buffer.from(content).toString('base64');
      const params: any = {
        owner,
        repo,
        path,
        message,
        content: encodedContent
      };
      
      if (sha) {
        params.sha = sha;
      }

      const { data } = await this.octokit.repos.createOrUpdateFileContents(params);
      return {
        path: data.content?.path,
        sha: data.content?.sha,
        commitSha: data.commit.sha
      };
    } catch (error) {
      logger.error('Failed to create/update file:', error);
      throw error;
    }
  }

  async deleteFile(owner: string, repo: string, path: string, sha: string, message: string) {
    try {
      const { data } = await this.octokit.repos.deleteFile({
        owner,
        repo,
        path,
        message,
        sha
      });
      return {
        commitSha: data.commit.sha,
        message: data.commit.message
      };
    } catch (error) {
      logger.error('Failed to delete file:', error);
      throw error;
    }
  }

  // Branch operations
  async listBranches(owner: string, repo: string) {
    try {
      const { data } = await this.octokit.repos.listBranches({ owner, repo });
      return data.map(branch => ({
        name: branch.name,
        protected: branch.protected,
        sha: branch.commit.sha
      }));
    } catch (error) {
      logger.error('Failed to list branches:', error);
      throw error;
    }
  }

  async createBranch(owner: string, repo: string, branch: string, fromBranch: string = 'main') {
    try {
      // Get the SHA of the source branch
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${fromBranch}`
      });

      // Create new branch
      const { data } = await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: refData.object.sha
      });

      return {
        branch,
        sha: data.object.sha
      };
    } catch (error) {
      logger.error('Failed to create branch:', error);
      throw error;
    }
  }

  // Pull request operations
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ) {
    try {
      const { data } = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body
      });
      return {
        number: data.number,
        url: data.html_url,
        state: data.state,
        title: data.title
      };
    } catch (error) {
      logger.error('Failed to create pull request:', error);
      throw error;
    }
  }

  async listPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    try {
      const { data } = await this.octokit.pulls.list({
        owner,
        repo,
        state
      });
      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        author: pr.user?.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at
      }));
    } catch (error) {
      logger.error('Failed to list pull requests:', error);
      throw error;
    }
  }

  // Issue operations
  async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]) {
    try {
      const { data } = await this.octokit.issues.create({
        owner,
        repo,
        title,
        body,
        labels
      });
      return {
        number: data.number,
        url: data.html_url,
        state: data.state,
        title: data.title
      };
    } catch (error) {
      logger.error('Failed to create issue:', error);
      throw error;
    }
  }

  async listIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state
      });
      return data.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        author: issue.user?.login,
        labels: issue.labels.map(l => typeof l === 'string' ? l : l.name),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at
      }));
    } catch (error) {
      logger.error('Failed to list issues:', error);
      throw error;
    }
  }

  // Search operations
  async searchCode(query: string, owner?: string, repo?: string) {
    try {
      let searchQuery = query;
      if (owner && repo) {
        searchQuery = `${query} repo:${owner}/${repo}`;
      } else if (owner) {
        searchQuery = `${query} user:${owner}`;
      }

      const { data } = await this.octokit.search.code({ q: searchQuery });
      return data.items.map(item => ({
        name: item.name,
        path: item.path,
        repository: item.repository.full_name,
        url: item.html_url,
        score: item.score
      }));
    } catch (error) {
      logger.error('Failed to search code:', error);
      throw error;
    }
  }

  // User operations
  async getCurrentUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        bio: data.bio,
        publicRepos: data.public_repos,
        followers: data.followers,
        following: data.following
      };
    } catch (error) {
      logger.error('Failed to get current user:', error);
      throw error;
    }
  }

  // Gist operations
  async createGist(description: string, files: Record<string, { content: string }>, isPublic: boolean = false) {
    try {
      const { data } = await this.octokit.gists.create({
        description,
        files,
        public: isPublic
      });
      return {
        id: data.id,
        url: data.html_url,
        description: data.description
      };
    } catch (error) {
      logger.error('Failed to create gist:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const githubMCP = new GitHubMCPServer();