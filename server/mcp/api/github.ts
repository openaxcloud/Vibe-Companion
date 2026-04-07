// @ts-nocheck
import { Router } from 'express';
import fetch from 'node-fetch';
import { ensureAuthenticated } from '../../middleware/auth';
import { githubOAuth } from '../../services/github-oauth';
import { storage } from '../../storage';

const router = Router();

const mapRepository = (repo: any) => ({
  id: repo.id,
  name: repo.name,
  fullName: repo.full_name ?? repo.fullName ?? (repo.owner?.login ? `${repo.owner.login}/${repo.name}` : repo.name),
  description: repo.description ?? null,
  url: repo.html_url ?? repo.url ?? null,
  sshUrl: repo.ssh_url ?? null,
  cloneUrl: repo.clone_url ?? null,
  private: Boolean(repo.private),
  stars: repo.stargazers_count ?? repo.stars ?? 0,
  forks: repo.forks_count ?? repo.forks ?? 0,
  watchers: repo.watchers_count ?? repo.watchers ?? 0,
  language: repo.language ?? null,
  updatedAt: repo.updated_at ?? repo.updatedAt ?? null,
  defaultBranch: repo.default_branch ?? repo.defaultBranch ?? 'main',
  owner: repo.owner?.login ?? repo.owner ?? null,
});

const resolveRepoCoordinates = async (userId: number, repo: string) => {
  const storedToken = await storage.getGitHubToken(userId);
  const [ownerPart, repoPart] = repo.includes('/') ? repo.split('/') : [storedToken?.githubUsername, repo];

  if (!ownerPart || !repoPart) {
    return null;
  }

  return { owner: ownerPart, repo: repoPart };
};

const githubRequest = async (token: string, url: string, options: RequestInit) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.message || 'GitHub request failed';
    return { error: { status: response.status, message } };
  }

  return { data: await response.json() };
};

// Get user repositories
router.get('/repositories', ensureAuthenticated, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(req.query.perPage as string, 10) || 30, 1), 100);

    if (error) {
      return res.status(error.status).json({
        error: 'GitHub not connected',
        message: error.message,
      });
    }

    const repos = await githubOAuth.getUserRepos(req.githubToken, page, perPage);
    res.json(repos.map(mapRepository));
  } catch (error: any) {
    console.error('GitHub MCP repositories error:', error);
    res.status(500).json({
      error: 'Failed to fetch repositories',
      message: error.message,
    });
  }
});

// Create repository
router.post('/repositories', ensureAuthenticated, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Repository name is required',
        message: 'Please provide a valid repository name.',
      });
    }

    const { octokit, error } = await createGitHubClient(req.user!.id);

    if (error) {
      return res.status(error.status).json({
        error: 'GitHub not connected',
        message: error.message,
      });
    }

    const { data } = await octokit.repos.createForAuthenticatedUser({
      name,
      description,
      private: Boolean(isPrivate),
      auto_init: true,
    });

    res.status(201).json({
      id: data.id,
      name: data.name,
      description: data.description,
      url: data.html_url,
      private: data.private,
      stars: data.stargazers_count,
      forks: data.forks_count,
      language: data.language,
      updatedAt: data.updated_at,
      defaultBranch: data.default_branch,
      owner: data.owner?.login,
    });
    const result = await githubRequest(req.githubToken, 'https://api.github.com/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        private: Boolean(isPrivate),
        auto_init: true,
      }),
    });

    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    res.status(201).json(mapRepository(result.data));
  } catch (error: any) {
    console.error('GitHub MCP create repository error:', error);
    res.status(500).json({
      error: 'Failed to create repository',
      message: error.message,
    });
  }
});

// Create issue
router.post('/issues', ensureAuthenticated, async (req, res) => {
  try {
    const { repo, title, body, labels } = req.body ?? {};

    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({
        error: 'Repository is required',
        message: 'Please provide the repository to create an issue in.',
      });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        error: 'Issue title is required',
        message: 'Please provide a valid issue title.',
      });
    }

    const coordinates = await resolveRepoCoordinates(req.user!.id, repo);
    if (!coordinates) {
      return res.status(400).json({
        error: 'Unable to resolve repository owner',
        message: 'Connect GitHub or provide the repository as "owner/name".',
      });
    }

    const issueResult = await githubRequest(
      req.githubToken,
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repo}/issues`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          labels: Array.isArray(labels) ? labels : undefined,
        }),
      }
    );

    if (issueResult.error) {
      return res.status(issueResult.error.status).json({ error: issueResult.error.message });
    }

    const issue = issueResult.data;
    res.status(201).json({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      labels: (issue.labels ?? [])
        .map((label: any) => (typeof label === 'string' ? label : label?.name))
        .filter(Boolean),
      state: issue.state,
      url: issue.html_url,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      author: issue.user?.login ?? null,
    });
  } catch (error: any) {
    console.error('GitHub MCP create issue error:', error);
    res.status(500).json({
      error: 'Failed to create issue',
      message: error.message,
    });
  }
});

// Create pull request
router.post('/pull-requests', ensureAuthenticated, async (req, res) => {
  try {
    const { repo, title, body, head, base } = req.body ?? {};

    if (!repo || typeof repo !== 'string') {
      return res.status(400).json({
        error: 'Repository is required',
        message: 'Please provide the repository to create a pull request in.',
      });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        error: 'Pull request title is required',
        message: 'Please provide a valid pull request title.',
      });
    }

    if (!head || !base) {
      return res.status(400).json({
        error: 'Branch information missing',
        message: 'Both head and base branches are required to create a pull request.',
      });
    }

    const coordinates = await resolveRepoCoordinates(req.user!.id, repo);
    if (!coordinates) {
      return res.status(400).json({
        error: 'Unable to resolve repository owner',
        message: 'Connect GitHub or provide the repository as "owner/name".',
      });
    }

    const result = await githubRequest(
      req.githubToken,
      `https://api.github.com/repos/${coordinates.owner}/${coordinates.repo}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          head,
          base,
        }),
      },
    );

    if (result.error) {
      return res.status(result.error.status).json({ error: result.error.message });
    }

    const pullRequest = result.data;
    res.status(201).json({
      number: pullRequest.number,
      title: pullRequest.title,
      body: pullRequest.body,
      head,
      base,
      state: pullRequest.state,
      url: pullRequest.html_url,
      createdAt: pullRequest.created_at,
      updatedAt: pullRequest.updated_at,
      author: pullRequest.user?.login ?? null,
    });
  } catch (error: any) {
    console.error('GitHub MCP create PR error:', error);
    res.status(500).json({
      error: 'Failed to create pull request',
      message: error.message,
    });
  }
});

export default router;
