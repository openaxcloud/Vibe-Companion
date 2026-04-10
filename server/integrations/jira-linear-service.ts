// @ts-nocheck
import { EventEmitter } from 'events';
import axios from 'axios';

interface JiraConfig {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

interface LinearConfig {
  apiKey: string;
  teamId: string;
  workspaceId?: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee?: string;
  priority: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

interface CreateIssueRequest {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  labels?: string[];
  projectId?: string;
}

export class JiraLinearService extends EventEmitter {
  private jiraConfigs: Map<string, JiraConfig> = new Map();
  private linearConfigs: Map<string, LinearConfig> = new Map();

  constructor() {
    super();
  }

  // Jira Configuration
  async configureJira(projectId: string, config: JiraConfig): Promise<void> {
    // Validate configuration
    await this.testJiraConnection(config);
    
    this.jiraConfigs.set(projectId, config);
    this.emit('jira:configured', { projectId, domain: config.domain });
  }

  async testJiraConnection(config: JiraConfig): Promise<boolean> {
    try {
      const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
      const response = await axios.get(`https://${config.domain}.atlassian.net/rest/api/3/myself`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      throw new Error('Jira connection failed: Invalid credentials or domain');
    }
  }

  // Linear Configuration
  async configureLinear(projectId: string, config: LinearConfig): Promise<void> {
    // Validate configuration
    await this.testLinearConnection(config);
    
    this.linearConfigs.set(projectId, config);
    this.emit('linear:configured', { projectId, teamId: config.teamId });
  }

  async testLinearConnection(config: LinearConfig): Promise<boolean> {
    try {
      const response = await axios.post('https://api.linear.app/graphql', {
        query: `
          query {
            viewer {
              id
              name
              email
            }
          }
        `
      }, {
        headers: {
          'Authorization': config.apiKey,
          'Content-Type': 'application/json'
        }
      });
      return !response.data.errors;
    } catch (error) {
      throw new Error('Linear connection failed: Invalid API key');
    }
  }

  // Jira Issue Management
  async createJiraIssue(projectId: string, issueData: CreateIssueRequest): Promise<Issue> {
    const config = this.jiraConfigs.get(projectId);
    if (!config) {
      throw new Error('Jira not configured for this project');
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    const jiraIssue = {
      fields: {
        project: {
          key: config.projectKey
        },
        summary: issueData.title,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: issueData.description,
                  type: 'text'
                }
              ]
            }
          ]
        },
        issuetype: {
          name: 'Task'
        },
        priority: {
          name: this.mapPriorityToJira(issueData.priority || 'medium')
        }
      }
    };

    if (issueData.assignee) {
      jiraIssue.fields['assignee'] = { accountId: issueData.assignee };
    }

    if (issueData.labels && issueData.labels.length > 0) {
      jiraIssue.fields['labels'] = issueData.labels;
    }

    const response = await axios.post(
      `https://${config.domain}.atlassian.net/rest/api/3/issue`,
      jiraIssue,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    const createdIssue = response.data;
    
    this.emit('jira:issue_created', { projectId, issueId: createdIssue.id });
    
    return this.formatJiraIssue(createdIssue, config.domain);
  }

  async getJiraIssues(projectId: string, limit: number = 50): Promise<Issue[]> {
    const config = this.jiraConfigs.get(projectId);
    if (!config) {
      throw new Error('Jira not configured for this project');
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    const response = await axios.get(
      `https://${config.domain}.atlassian.net/rest/api/3/search`,
      {
        params: {
          jql: `project = ${config.projectKey} ORDER BY created DESC`,
          maxResults: limit,
          fields: 'summary,description,status,assignee,priority,labels,created,updated'
        },
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    return response.data.issues.map((issue: any) => this.formatJiraIssue(issue, config.domain));
  }

  async updateJiraIssue(projectId: string, issueId: string, updates: Partial<CreateIssueRequest>): Promise<void> {
    const config = this.jiraConfigs.get(projectId);
    if (!config) {
      throw new Error('Jira not configured for this project');
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    const updateFields: any = {};
    
    if (updates.title) {
      updateFields.summary = updates.title;
    }
    
    if (updates.description) {
      updateFields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                text: updates.description,
                type: 'text'
              }
            ]
          }
        ]
      };
    }

    if (updates.priority) {
      updateFields.priority = { name: this.mapPriorityToJira(updates.priority) };
    }

    await axios.put(
      `https://${config.domain}.atlassian.net/rest/api/3/issue/${issueId}`,
      { fields: updateFields },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    this.emit('jira:issue_updated', { projectId, issueId });
  }

  // Linear Issue Management
  async createLinearIssue(projectId: string, issueData: CreateIssueRequest): Promise<Issue> {
    const config = this.linearConfigs.get(projectId);
    if (!config) {
      throw new Error('Linear not configured for this project');
    }

    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            title
            description
            state {
              name
            }
            assignee {
              name
              email
            }
            priority
            labels {
              nodes {
                name
              }
            }
            createdAt
            updatedAt
            url
          }
        }
      }
    `;

    const variables = {
      input: {
        teamId: config.teamId,
        title: issueData.title,
        description: issueData.description,
        priority: this.mapPriorityToLinear(issueData.priority || 'medium')
      }
    };

    if (issueData.assignee) {
      variables.input['assigneeId'] = issueData.assignee;
    }

    if (issueData.labels && issueData.labels.length > 0) {
      variables.input['labelIds'] = issueData.labels;
    }

    const response = await axios.post('https://api.linear.app/graphql', {
      query: mutation,
      variables
    }, {
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      throw new Error('Linear API error: ' + response.data.errors[0].message);
    }

    const createdIssue = response.data.data.issueCreate.issue;
    this.emit('linear:issue_created', { projectId, issueId: createdIssue.id });
    
    return this.formatLinearIssue(createdIssue);
  }

  async getLinearIssues(projectId: string, limit: number = 50): Promise<Issue[]> {
    const config = this.linearConfigs.get(projectId);
    if (!config) {
      throw new Error('Linear not configured for this project');
    }

    const query = `
      query Issues($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          issues(first: $first, orderBy: createdAt) {
            nodes {
              id
              title
              description
              state {
                name
              }
              assignee {
                name
                email
              }
              priority
              labels {
                nodes {
                  name
                }
              }
              createdAt
              updatedAt
              url
            }
          }
        }
      }
    `;

    const response = await axios.post('https://api.linear.app/graphql', {
      query,
      variables: {
        teamId: config.teamId,
        first: limit
      }
    }, {
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      throw new Error('Linear API error: ' + response.data.errors[0].message);
    }

    return response.data.data.team.issues.nodes.map((issue: any) => this.formatLinearIssue(issue));
  }

  async updateLinearIssue(projectId: string, issueId: string, updates: Partial<CreateIssueRequest>): Promise<void> {
    const config = this.linearConfigs.get(projectId);
    if (!config) {
      throw new Error('Linear not configured for this project');
    }

    const mutation = `
      mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
    `;

    const input: any = {};
    
    if (updates.title) {
      input.title = updates.title;
    }
    
    if (updates.description) {
      input.description = updates.description;
    }

    if (updates.priority) {
      input.priority = this.mapPriorityToLinear(updates.priority);
    }

    const response = await axios.post('https://api.linear.app/graphql', {
      query: mutation,
      variables: {
        id: issueId,
        input
      }
    }, {
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.errors) {
      throw new Error('Linear API error: ' + response.data.errors[0].message);
    }

    this.emit('linear:issue_updated', { projectId, issueId });
  }

  // Sync Issues Between Services
  async syncProjectIssues(projectId: string): Promise<{ jira: Issue[], linear: Issue[] }> {
    const results = {
      jira: [] as Issue[],
      linear: [] as Issue[]
    };

    if (this.jiraConfigs.has(projectId)) {
      results.jira = await this.getJiraIssues(projectId);
    }

    if (this.linearConfigs.has(projectId)) {
      results.linear = await this.getLinearIssues(projectId);
    }

    this.emit('sync:completed', { projectId, counts: { jira: results.jira.length, linear: results.linear.length } });
    
    return results;
  }

  // Team Management
  async getJiraProjects(projectId: string): Promise<any[]> {
    const config = this.jiraConfigs.get(projectId);
    if (!config) {
      throw new Error('Jira not configured');
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    
    const response = await axios.get(
      `https://${config.domain}.atlassian.net/rest/api/3/project`,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      }
    );

    return response.data;
  }

  async getLinearTeams(projectId: string): Promise<any[]> {
    const config = this.linearConfigs.get(projectId);
    if (!config) {
      throw new Error('Linear not configured');
    }

    const query = `
      query {
        teams {
          nodes {
            id
            name
            description
            key
          }
        }
      }
    `;

    const response = await axios.post('https://api.linear.app/graphql', {
      query
    }, {
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data.data.teams.nodes;
  }

  // Utility Methods
  private formatJiraIssue(jiraIssue: any, domain: string): Issue {
    return {
      id: jiraIssue.id,
      title: jiraIssue.fields.summary,
      description: jiraIssue.fields.description?.content?.[0]?.content?.[0]?.text || '',
      status: jiraIssue.fields.status.name,
      assignee: jiraIssue.fields.assignee?.displayName,
      priority: jiraIssue.fields.priority.name,
      labels: jiraIssue.fields.labels || [],
      createdAt: new Date(jiraIssue.fields.created),
      updatedAt: new Date(jiraIssue.fields.updated),
      url: `https://${domain}.atlassian.net/browse/${jiraIssue.key}`
    };
  }

  private formatLinearIssue(linearIssue: any): Issue {
    return {
      id: linearIssue.id,
      title: linearIssue.title,
      description: linearIssue.description || '',
      status: linearIssue.state.name,
      assignee: linearIssue.assignee?.name,
      priority: linearIssue.priority.toString(),
      labels: linearIssue.labels.nodes.map((label: any) => label.name),
      createdAt: new Date(linearIssue.createdAt),
      updatedAt: new Date(linearIssue.updatedAt),
      url: linearIssue.url
    };
  }

  private mapPriorityToJira(priority: string): string {
    const mapping = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'critical': 'Highest'
    };
    return mapping[priority as keyof typeof mapping] || 'Medium';
  }

  private mapPriorityToLinear(priority: string): number {
    const mapping = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return mapping[priority as keyof typeof mapping] || 2;
  }

  // Configuration Management
  getJiraConfig(projectId: string): JiraConfig | undefined {
    return this.jiraConfigs.get(projectId);
  }

  getLinearConfig(projectId: string): LinearConfig | undefined {
    return this.linearConfigs.get(projectId);
  }

  removeJiraConfig(projectId: string): void {
    this.jiraConfigs.delete(projectId);
    this.emit('jira:removed', { projectId });
  }

  removeLinearConfig(projectId: string): void {
    this.linearConfigs.delete(projectId);
    this.emit('linear:removed', { projectId });
  }
}