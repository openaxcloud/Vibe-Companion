import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

function sanitizeGraphQLParam(val: string): string {
  return val.replace(/[\\"]/g, "").slice(0, 500);
}

function safeJsonParse(val: string, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function sanitizePathParam(val: string): string {
  return encodeURIComponent(val.replace(/[\/\\\.\.]/g, "").slice(0, 200));
}

interface ConnectorOperation {
  method: string;
  path: (params: Record<string, string>) => string;
  body?: (params: Record<string, string>) => Record<string, unknown>;
  extraHeaders?: Record<string, string>;
  description: string;
  type: "read" | "write";
}

interface ConnectorConfig {
  connectorName: string;
  baseUrl: string;
  authHeader: (config: Record<string, string>) => Record<string, string>;
  resolveParams?: (params: Record<string, string>, credentials: Record<string, string>) => Record<string, string>;
  operations: Record<string, ConnectorOperation>;
}

const CONNECTOR_CONFIGS: Record<string, ConnectorConfig> = {
  linear: {
    connectorName: "linear",
    baseUrl: "https://api.linear.app",
    authHeader: (c) => ({ Authorization: c.LINEAR_API_KEY, "Content-Type": "application/json" }),
    operations: {
      list_issues: {
        method: "POST",
        path: () => "/graphql",
        body: (p) => {
          const first = Math.min(Math.max(parseInt(p.limit || "25") || 25, 1), 50);
          if (p.filter) {
            return {
              query: "query($first: Int!, $filter: IssueFilter) { issues(first: $first, filter: $filter) { nodes { id identifier title state { name } assignee { name } priority priorityLabel createdAt updatedAt } } }",
              variables: { first, filter: { state: { name: { eq: sanitizeGraphQLParam(p.filter) } } } },
            };
          }
          return {
            query: "query($first: Int!) { issues(first: $first) { nodes { id identifier title state { name } assignee { name } priority priorityLabel createdAt updatedAt } } }",
            variables: { first },
          };
        },
        description: "List Linear issues",
        type: "read",
      },
      get_issue: {
        method: "POST",
        path: () => "/graphql",
        body: (p) => ({
          query: "query($id: String!) { issue(id: $id) { id identifier title description state { name } assignee { name } priority priorityLabel labels { nodes { name } } createdAt updatedAt } }",
          variables: { id: sanitizeGraphQLParam(p.issueId) },
        }),
        description: "Get a specific Linear issue",
        type: "read",
      },
      create_issue: {
        method: "POST",
        path: () => "/graphql",
        body: (p) => {
          const input: Record<string, string> = { title: p.title || "Untitled" };
          if (p.description) input.description = p.description;
          if (p.teamId) input.teamId = sanitizeGraphQLParam(p.teamId);
          return {
            query: "mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title state { name } } } }",
            variables: { input },
          };
        },
        description: "Create a new Linear issue",
        type: "write",
      },
      list_teams: {
        method: "POST",
        path: () => "/graphql",
        body: () => ({ query: "{ teams { nodes { id name key } } }" }),
        description: "List Linear teams",
        type: "read",
      },
      list_projects: {
        method: "POST",
        path: () => "/graphql",
        body: () => ({ query: "{ projects(first: 25) { nodes { id name state } } }" }),
        description: "List Linear projects",
        type: "read",
      },
    },
  },
  slack: {
    connectorName: "slack",
    baseUrl: "https://slack.com/api",
    authHeader: (c) => ({ Authorization: `Bearer ${c.SLACK_BOT_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_channels: {
        method: "GET",
        path: (p) => `/conversations.list?types=public_channel,private_channel&limit=${p.limit || "20"}`,
        description: "List Slack channels",
        type: "read",
      },
      list_messages: {
        method: "GET",
        path: (p) => `/conversations.history?channel=${encodeURIComponent(p.channel)}&limit=${p.limit || "10"}`,
        description: "List recent messages in a Slack channel",
        type: "read",
      },
      send_message: {
        method: "POST",
        path: () => "/chat.postMessage",
        body: (p) => ({ channel: p.channel, text: p.text }),
        description: "Send a message to a Slack channel",
        type: "write",
      },
      list_users: {
        method: "GET",
        path: (p) => `/users.list?limit=${p.limit || "50"}`,
        description: "List Slack workspace users",
        type: "read",
      },
    },
  },
  notion: {
    connectorName: "notion",
    baseUrl: "https://api.notion.com/v1",
    authHeader: (c) => ({ Authorization: `Bearer ${c.NOTION_API_KEY}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }),
    operations: {
      list_pages: {
        method: "POST",
        path: () => "/search",
        body: (p) => ({ filter: { property: "object", value: "page" }, page_size: parseInt(p.limit || "10") }),
        description: "Search and list Notion pages",
        type: "read",
      },
      list_databases: {
        method: "POST",
        path: () => "/search",
        body: (p) => ({ filter: { property: "object", value: "database" }, page_size: parseInt(p.limit || "10") }),
        description: "Search and list Notion databases",
        type: "read",
      },
      get_page: {
        method: "GET",
        path: (p) => `/pages/${encodeURIComponent(p.pageId)}`,
        description: "Get a Notion page by ID",
        type: "read",
      },
      create_page: {
        method: "POST",
        path: () => "/pages",
        body: (p) => ({
          parent: p.databaseId ? { database_id: p.databaseId } : { page_id: p.parentPageId },
          properties: { title: { title: [{ text: { content: p.title || "Untitled" } }] } },
          ...(p.content ? { children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: p.content } }] } }] } : {}),
        }),
        description: "Create a new Notion page",
        type: "write",
      },
      query_database: {
        method: "POST",
        path: (p) => `/databases/${encodeURIComponent(p.databaseId)}/query`,
        body: (p) => ({ page_size: parseInt(p.limit || "10") }),
        description: "Query a Notion database",
        type: "read",
      },
    },
  },
  bigquery: {
    connectorName: "bigquery",
    baseUrl: "https://bigquery.googleapis.com/bigquery/v2",
    authHeader: (c) => ({ Authorization: `Bearer ${c.BIGQUERY_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    resolveParams: (params, creds) => ({
      ...params,
      projectId: params.projectId || creds.BIGQUERY_PROJECT_ID || "",
    }),
    operations: {
      list_datasets: {
        method: "GET",
        path: (p) => `/projects/${encodeURIComponent(p.projectId)}/datasets`,
        description: "List BigQuery datasets",
        type: "read",
      },
      list_tables: {
        method: "GET",
        path: (p) => `/projects/${encodeURIComponent(p.projectId)}/datasets/${encodeURIComponent(p.datasetId)}/tables`,
        description: "List tables in a BigQuery dataset",
        type: "read",
      },
      run_query: {
        method: "POST",
        path: (p) => `/projects/${encodeURIComponent(p.projectId)}/queries`,
        body: (p) => ({
          query: p.query,
          useLegacySql: false,
          maxResults: parseInt(p.limit || "100"),
        }),
        description: "Run a SQL query on BigQuery",
        type: "read",
      },
    },
  },
  amplitude: {
    connectorName: "amplitude",
    baseUrl: "https://amplitude.com/api/2",
    authHeader: (c) => ({ Authorization: `Basic ${Buffer.from(`${c.AMPLITUDE_API_KEY}:${c.AMPLITUDE_SECRET_KEY}`).toString("base64")}` }),
    operations: {
      get_events: {
        method: "GET",
        path: (p) => `/events/segmentation?e=${encodeURIComponent(JSON.stringify({ event_type: p.eventType || "Any Active Event" }))}&start=${encodeURIComponent(p.start || "20240101")}&end=${encodeURIComponent(p.end || "20241231")}`,
        description: "Get event segmentation data",
        type: "read",
      },
      get_user_activity: {
        method: "GET",
        path: (p) => `/useractivity?user=${encodeURIComponent(p.userId)}`,
        description: "Get user activity",
        type: "read",
      },
    },
  },
  segment: {
    connectorName: "segment",
    baseUrl: "https://api.segment.io/v1",
    authHeader: (c) => ({ Authorization: `Basic ${Buffer.from(`${c.SEGMENT_WRITE_KEY}:`).toString("base64")}`, "Content-Type": "application/json" }),
    operations: {
      track: {
        method: "POST",
        path: () => "/track",
        body: (p) => ({
          userId: p.userId,
          event: p.event,
          properties: p.properties ? safeJsonParse(p.properties) : {},
        }),
        description: "Track an event in Segment",
        type: "write",
      },
      identify: {
        method: "POST",
        path: () => "/identify",
        body: (p) => ({
          userId: p.userId,
          traits: p.traits ? safeJsonParse(p.traits) : {},
        }),
        description: "Identify a user in Segment",
        type: "write",
      },
    },
  },
  hex: {
    connectorName: "hex",
    baseUrl: "https://app.hex.tech/api/v1",
    authHeader: (c) => ({ Authorization: `Bearer ${c.HEX_API_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_projects: {
        method: "GET",
        path: (p) => `/projects?limit=${p.limit || "20"}`,
        description: "List Hex projects",
        type: "read",
      },
      get_project: {
        method: "GET",
        path: (p) => `/projects/${sanitizePathParam(p.projectId)}`,
        description: "Get a Hex project",
        type: "read",
      },
      run_project: {
        method: "POST",
        path: (p) => `/projects/${sanitizePathParam(p.projectId)}/runs`,
        body: (p) => ({
          ...(p.inputParams ? { inputParams: safeJsonParse(p.inputParams) } : {}),
        }),
        description: "Run a Hex project",
        type: "write",
      },
      get_run_status: {
        method: "GET",
        path: (p) => `/projects/${sanitizePathParam(p.projectId)}/runs/${sanitizePathParam(p.runId)}`,
        description: "Get the status of a Hex project run",
        type: "read",
      },
    },
  },
  google_drive: {
    connectorName: "google_drive",
    baseUrl: "https://www.googleapis.com/drive/v3",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.GOOGLE_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_files: {
        method: "GET",
        path: (p) => `/files?pageSize=${p.limit || "20"}&fields=files(id,name,mimeType,modifiedTime,size)`,
        description: "List files in Google Drive",
        type: "read",
      },
      get_file: {
        method: "GET",
        path: (p) => `/files/${encodeURIComponent(p.fileId)}?fields=id,name,mimeType,modifiedTime,size,webViewLink`,
        description: "Get file metadata from Google Drive",
        type: "read",
      },
    },
  },
  google_sheets: {
    connectorName: "google_sheets",
    baseUrl: "https://sheets.googleapis.com/v4",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.GOOGLE_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      get_spreadsheet: {
        method: "GET",
        path: (p) => `/spreadsheets/${encodeURIComponent(p.spreadsheetId)}`,
        description: "Get a Google Sheets spreadsheet",
        type: "read",
      },
      get_values: {
        method: "GET",
        path: (p) => `/spreadsheets/${encodeURIComponent(p.spreadsheetId)}/values/${encodeURIComponent(p.range || "Sheet1")}`,
        description: "Get values from a sheet range",
        type: "read",
      },
    },
  },
  google_calendar: {
    connectorName: "google_calendar",
    baseUrl: "https://www.googleapis.com/calendar/v3",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.GOOGLE_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_events: {
        method: "GET",
        path: (p) => `/calendars/${encodeURIComponent(p.calendarId || "primary")}/events?maxResults=${p.limit || "10"}&orderBy=startTime&singleEvents=true&timeMin=${new Date().toISOString()}`,
        description: "List upcoming calendar events",
        type: "read",
      },
      create_event: {
        method: "POST",
        path: (p) => `/calendars/${encodeURIComponent(p.calendarId || "primary")}/events`,
        body: (p) => ({
          summary: p.summary || "Untitled Event",
          start: { dateTime: p.startTime },
          end: { dateTime: p.endTime },
          ...(p.description ? { description: p.description } : {}),
        }),
        description: "Create a new calendar event",
        type: "write",
      },
    },
  },
  hubspot: {
    connectorName: "hubspot",
    baseUrl: "https://api.hubapi.com",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_contacts: {
        method: "GET",
        path: (p) => `/crm/v3/objects/contacts?limit=${p.limit || "10"}`,
        description: "List HubSpot contacts",
        type: "read",
      },
      get_contact: {
        method: "GET",
        path: (p) => `/crm/v3/objects/contacts/${encodeURIComponent(p.contactId)}`,
        description: "Get a specific HubSpot contact",
        type: "read",
      },
      create_contact: {
        method: "POST",
        path: () => "/crm/v3/objects/contacts",
        body: (p) => ({
          properties: {
            email: p.email,
            firstname: p.firstName || "",
            lastname: p.lastName || "",
          },
        }),
        description: "Create a new HubSpot contact",
        type: "write",
      },
    },
  },
  salesforce: {
    connectorName: "salesforce",
    baseUrl: "https://login.salesforce.com/services/data/v59.0",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.SALESFORCE_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      query: {
        method: "GET",
        path: (p) => `/query?q=${encodeURIComponent(p.soql || "SELECT Id, Name FROM Account LIMIT 10")}`,
        description: "Execute a Salesforce SOQL query",
        type: "read",
      },
    },
  },
  discord: {
    connectorName: "discord",
    baseUrl: "https://discord.com/api/v10",
    authHeader: (c) => ({ Authorization: `Bot ${c.access_token || c.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_guilds: {
        method: "GET",
        path: () => "/users/@me/guilds",
        description: "List Discord servers the bot is in",
        type: "read",
      },
      send_message: {
        method: "POST",
        path: (p) => `/channels/${encodeURIComponent(p.channelId)}/messages`,
        body: (p) => ({ content: p.content }),
        description: "Send a message to a Discord channel",
        type: "write",
      },
    },
  },
  dropbox: {
    connectorName: "dropbox",
    baseUrl: "https://api.dropboxapi.com/2",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.DROPBOX_ACCESS_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_files: {
        method: "POST",
        path: () => "/files/list_folder",
        body: (p) => ({ path: p.path || "", limit: parseInt(p.limit || "20") }),
        description: "List files in a Dropbox folder",
        type: "read",
      },
    },
  },
  todoist: {
    connectorName: "todoist",
    baseUrl: "https://api.todoist.com/rest/v2",
    authHeader: (c) => ({ Authorization: `Bearer ${c.access_token || c.TODOIST_API_TOKEN}`, "Content-Type": "application/json" }),
    operations: {
      list_tasks: {
        method: "GET",
        path: () => "/tasks",
        description: "List all active Todoist tasks",
        type: "read",
      },
      create_task: {
        method: "POST",
        path: () => "/tasks",
        body: (p) => ({
          content: p.content || "Untitled Task",
          ...(p.dueDate ? { due_date: p.dueDate } : {}),
          ...(p.priority ? { priority: parseInt(p.priority) } : {}),
        }),
        description: "Create a new Todoist task",
        type: "write",
      },
    },
  },
};

const CONNECTOR_NAME_MAP: Record<string, string> = {
  "Linear": "linear",
  "Slack": "slack",
  "Notion": "notion",
  "BigQuery": "bigquery",
  "Amplitude": "amplitude",
  "Segment": "segment",
  "Hex": "hex",
  "Google Drive": "google_drive",
  "Google Sheets": "google_sheets",
  "Google Calendar": "google_calendar",
  "HubSpot": "hubspot",
  "Salesforce": "salesforce",
  "Discord": "discord",
  "Dropbox": "dropbox",
  "Todoist": "todoist",
};

export function getConnectorKey(serviceName: string): string | null {
  return CONNECTOR_NAME_MAP[serviceName] || null;
}

export function getSupportedConnectors(): string[] {
  return Object.keys(CONNECTOR_NAME_MAP);
}

export function getConnectorOperations(connectorKey: string): { name: string; description: string; type: string }[] {
  const config = CONNECTOR_CONFIGS[connectorKey];
  if (!config) return [];
  return Object.entries(config.operations).map(([name, op]) => ({
    name,
    description: op.description,
    type: op.type,
  }));
}

export function getOperationType(connectorKey: string, operation: string): "read" | "write" | null {
  const config = CONNECTOR_CONFIGS[connectorKey];
  if (!config) return null;
  const op = config.operations[operation];
  return op ? op.type : null;
}

async function tryProxyFetch(
  connectorKey: string,
  path: string,
  options: { method: string; headers?: Record<string, string>; body?: string },
): Promise<Response | null> {
  try {
    const connections = await connectors.listConnections({ connector_names: connectorKey });
    if (!connections || connections.length === 0) return null;
    return await connectors.proxy(connectorKey, path, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });
  } catch {
    return null;
  }
}

async function directFetch(
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
): Promise<Response> {
  const fetchOptions: RequestInit = {
    method: options.method,
    headers: options.headers,
    signal: AbortSignal.timeout(15000),
  };
  if (options.body) {
    fetchOptions.body = options.body;
  }
  return fetch(url, fetchOptions);
}

export async function executeConnectorOperation(
  connectorKey: string,
  operation: string,
  params: Record<string, string>,
  credentials: Record<string, string>,
  allowedType?: "read" | "write",
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const config = CONNECTOR_CONFIGS[connectorKey];
  if (!config) {
    return { success: false, error: `Unknown connector: ${connectorKey}` };
  }

  const op = config.operations[operation];
  if (!op) {
    const available = Object.keys(config.operations).join(", ");
    return { success: false, error: `Unknown operation "${operation}" for ${connectorKey}. Available: ${available}` };
  }

  if (allowedType && op.type !== allowedType) {
    return { success: false, error: `Operation "${operation}" is a ${op.type} operation but was called via ${allowedType === "read" ? "query_connector" : "write_connector"}. Use ${op.type === "read" ? "query_connector" : "write_connector"} instead.` };
  }

  try {
    const resolvedParams = config.resolveParams ? config.resolveParams(params, credentials) : params;
    const path = op.path(resolvedParams);
    const authHeaders = config.authHeader(credentials);
    const bodyStr = op.body && (op.method === "POST" || op.method === "PUT" || op.method === "PATCH")
      ? JSON.stringify(op.body(resolvedParams))
      : undefined;
    const headers: Record<string, string> = { ...authHeaders };
    if (bodyStr && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (op.extraHeaders) {
      Object.assign(headers, op.extraHeaders);
    }

    let response = await tryProxyFetch(config.connectorName, path, {
      method: op.method,
      headers,
      body: bodyStr,
    });

    if (!response) {
      const fullUrl = `${config.baseUrl}${path}`;
      response = await directFetch(fullUrl, { method: op.method, headers, body: bodyStr });
    }

    const responseText = await response.text();

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${typeof data === "object" ? JSON.stringify(data).slice(0, 200) : String(data).slice(0, 200)}`,
      };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const error = err as Error & { name?: string };
    const msg = error.name === "TimeoutError" ? "Request timed out" : (error.message || "Request failed");
    return { success: false, error: msg };
  }
}

export function getConnectorDescription(): string {
  const descriptions: string[] = [];
  for (const [serviceName, connectorKey] of Object.entries(CONNECTOR_NAME_MAP)) {
    const config = CONNECTOR_CONFIGS[connectorKey];
    if (!config) continue;
    const ops = Object.entries(config.operations)
      .map(([name, op]) => `  - ${name} (${op.type}): ${op.description}`)
      .join("\n");
    descriptions.push(`${serviceName} (connector: "${connectorKey}"):\n${ops}`);
  }
  return descriptions.join("\n\n");
}
