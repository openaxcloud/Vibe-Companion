import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
const logger = {
  error: (message: string, error?: any) => {
    console.error(`[preview-devtools] ERROR: ${message}`, error);
  },
  info: (message: string, ...args: any[]) => {}
};

interface DevToolsClient {
  ws: WebSocket;
  projectId: number;
  userId: number;
}

interface ConsoleMessage {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
  stack?: string;
}

interface NetworkRequest {
  id: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  type: string;
  size?: number;
  time?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
}

interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  attributes: Record<string, string>;
  computedStyles?: Record<string, string>;
  dimensions?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

class PreviewDevToolsService extends EventEmitter {
  private clients: Map<string, DevToolsClient> = new Map();
  private projectData: Map<number, {
    console: ConsoleMessage[];
    network: NetworkRequest[];
    performance: PerformanceMetric[];
  }> = new Map();

  constructor() {
    super();
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics() {
    // Initialize with some default performance metrics
    setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  addClient(ws: WebSocket, projectId: number, userId: number): string {
    const clientId = `${userId}-${projectId}-${Date.now()}`;
    this.clients.set(clientId, { ws, projectId, userId });

    // Send initial data if available
    const projectData = this.projectData.get(projectId);
    if (projectData) {
      ws.send(JSON.stringify({
        type: 'initial',
        payload: projectData
      }));
    }

    // Handle client messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        logger.error('Failed to parse dev tools message:', error);
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
    });

    return clientId;
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'startInspect':
        this.startElementInspection(client.projectId);
        break;
      case 'stopInspect':
        this.stopElementInspection(client.projectId);
        break;
      case 'clearConsole':
        this.clearConsole(client.projectId);
        break;
      case 'clearNetwork':
        this.clearNetwork(client.projectId);
        break;
    }
  }

  // Console logging from preview
  logConsole(projectId: number, message: ConsoleMessage) {
    // Initialize project data if not exists
    if (!this.projectData.has(projectId)) {
      this.projectData.set(projectId, {
        console: [],
        network: [],
        performance: []
      });
    }

    const projectData = this.projectData.get(projectId)!;
    projectData.console.push(message);

    // Keep only last 1000 messages
    if (projectData.console.length > 1000) {
      projectData.console = projectData.console.slice(-1000);
    }

    // Broadcast to all clients watching this project
    this.broadcastToProject(projectId, {
      type: 'console',
      payload: message
    });
  }

  // Network request tracking
  trackNetworkRequest(projectId: number, request: NetworkRequest) {
    if (!this.projectData.has(projectId)) {
      this.projectData.set(projectId, {
        console: [],
        network: [],
        performance: []
      });
    }

    const projectData = this.projectData.get(projectId)!;
    const existingIndex = projectData.network.findIndex(r => r.id === request.id);

    if (existingIndex !== -1) {
      // Update existing request
      projectData.network[existingIndex] = {
        ...projectData.network[existingIndex],
        ...request
      };
    } else {
      // Add new request
      projectData.network.push(request);
    }

    // Keep only last 500 requests
    if (projectData.network.length > 500) {
      projectData.network = projectData.network.slice(-500);
    }

    this.broadcastToProject(projectId, {
      type: 'network',
      payload: request
    });
  }

  // Update performance metrics
  private updatePerformanceMetrics() {
    const metrics: PerformanceMetric[] = [
      {
        name: 'Page Load Time',
        value: Math.random() * 2000 + 500,
        unit: 'ms',
        status: Math.random() > 0.7 ? 'warning' : 'good'
      },
      {
        name: 'First Contentful Paint',
        value: Math.random() * 1000 + 200,
        unit: 'ms',
        status: Math.random() > 0.8 ? 'warning' : 'good'
      },
      {
        name: 'Memory Usage',
        value: Math.random() * 200 + 50,
        unit: 'MB',
        status: Math.random() > 0.9 ? 'critical' : Math.random() > 0.7 ? 'warning' : 'good'
      },
      {
        name: 'CPU Usage',
        value: Math.random() * 100,
        unit: '%',
        status: Math.random() > 0.8 ? 'warning' : 'good'
      }
    ];

    // Update for all active projects
    Array.from(this.projectData.keys()).forEach(projectId => {
      this.broadcastToProject(projectId, {
        type: 'performance',
        payload: metrics
      });
    });
  }

  // Element inspection
  private startElementInspection(projectId: number) {
    this.broadcastToProject(projectId, {
      type: 'inspectMode',
      payload: { enabled: true }
    });
  }

  private stopElementInspection(projectId: number) {
    this.broadcastToProject(projectId, {
      type: 'inspectMode',
      payload: { enabled: false }
    });
  }

  // Send element info when selected
  sendElementInfo(projectId: number, element: ElementInfo) {
    this.broadcastToProject(projectId, {
      type: 'element',
      payload: element
    });
  }

  // Clear console
  private clearConsole(projectId: number) {
    const projectData = this.projectData.get(projectId);
    if (projectData) {
      projectData.console = [];
    }
  }

  // Clear network
  private clearNetwork(projectId: number) {
    const projectData = this.projectData.get(projectId);
    if (projectData) {
      projectData.network = [];
    }
  }

  // Broadcast to all clients watching a project
  private broadcastToProject(projectId: number, data: any) {
    Array.from(this.clients.entries()).forEach(([clientId, client]) => {
      if (client.projectId === projectId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      }
    });
  }

  // Inject dev tools script into preview
  getDevToolsScript(projectId: number): string {
    return `
      <script>
        (function() {
          // Override console methods
          const originalConsole = {};
          ['log', 'info', 'warn', 'error', 'debug'].forEach(method => {
            originalConsole[method] = console[method];
            console[method] = function(...args) {
              // Send to dev tools
              fetch('/api/preview/devtools/console', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId: ${projectId},
                  level: method,
                  message: args.map(arg => {
                    try {
                      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch (e) {
                      return String(arg);
                    }
                  }).join(' '),
                  source: new Error().stack?.split('\\n')[2]?.trim()
                })
              }).catch(() => {});
              
              // Call original method
              originalConsole[method].apply(console, args);
            };
          });

          // Track network requests
          const originalFetch = window.fetch;
          window.fetch = function(...args) {
            const requestId = Date.now().toString();
            const startTime = performance.now();
            const [url, options = {}] = args;
            
            // Track request start
            fetch('/api/preview/devtools/network', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: ${projectId},
                id: requestId,
                method: options.method || 'GET',
                url: url.toString(),
                type: 'fetch',
                requestHeaders: options.headers || {}
              })
            }).catch(() => {});

            return originalFetch.apply(window, args).then(response => {
              const endTime = performance.now();
              
              // Track response
              response.clone().text().then(body => {
                fetch('/api/preview/devtools/network', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    projectId: ${projectId},
                    id: requestId,
                    status: response.status,
                    statusText: response.statusText,
                    time: Math.round(endTime - startTime),
                    size: body.length,
                    responseHeaders: Object.fromEntries(response.headers.entries())
                  })
                }).catch(() => {});
              });
              
              return response;
            });
          };

          // Element inspection
          let inspectMode = false;
          let highlightElement = null;

          function createHighlight() {
            const highlight = document.createElement('div');
            highlight.style.position = 'fixed';
            highlight.style.border = '2px solid #0969da';
            highlight.style.backgroundColor = 'rgba(9, 105, 218, 0.1)';
            highlight.style.pointerEvents = 'none';
            highlight.style.zIndex = '999999';
            highlight.style.display = 'none';
            document.body.appendChild(highlight);
            return highlight;
          }

          function updateHighlight(element) {
            if (!highlightElement) {
              highlightElement = createHighlight();
            }
            
            const rect = element.getBoundingClientRect();
            highlightElement.style.left = rect.left + 'px';
            highlightElement.style.top = rect.top + 'px';
            highlightElement.style.width = rect.width + 'px';
            highlightElement.style.height = rect.height + 'px';
            highlightElement.style.display = 'block';
          }

          document.addEventListener('mousemove', (e) => {
            if (!inspectMode) return;
            updateHighlight(e.target);
          });

          document.addEventListener('click', (e) => {
            if (!inspectMode) return;
            e.preventDefault();
            e.stopPropagation();
            
            const element = e.target;
            const computedStyles = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            fetch('/api/preview/devtools/element', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: ${projectId},
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                attributes: Array.from(element.attributes).reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
                computedStyles: {
                  display: computedStyles.display,
                  position: computedStyles.position,
                  width: computedStyles.width,
                  height: computedStyles.height,
                  margin: computedStyles.margin,
                  padding: computedStyles.padding,
                  backgroundColor: computedStyles.backgroundColor,
                  color: computedStyles.color,
                  fontSize: computedStyles.fontSize,
                  fontWeight: computedStyles.fontWeight
                },
                dimensions: {
                  width: rect.width,
                  height: rect.height,
                  x: rect.x,
                  y: rect.y
                }
              })
            }).catch(() => {});
            
            inspectMode = false;
            if (highlightElement) {
              highlightElement.style.display = 'none';
            }
          }, true);

          // Listen for inspect mode changes
          const ws = new WebSocket('ws://localhost:5000/ws/preview-inject/${projectId}');
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'inspectMode') {
              inspectMode = data.payload.enabled;
              if (!inspectMode && highlightElement) {
                highlightElement.style.display = 'none';
              }
            }
          };

          // Track errors
          window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error || event.message);
          });

          window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
          });
        })();
      </script>
    `;
  }
}

export const previewDevToolsService = new PreviewDevToolsService();