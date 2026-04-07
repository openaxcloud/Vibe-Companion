import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';
import { File } from '@shared/schema';
import readline from 'readline';
import { createLogger } from './utils/logger';

// Create a logger for the terminal module
const logger = createLogger('terminal');

// Map to store terminal processes by projectId
const terminalProcesses = new Map<number, {
  process: ChildProcess | null;
  clients: Set<WebSocket>;
  commandHistory: string[];
  autocompleteSuggestions: string[];
  columns?: number;
  rows?: number;
}>();

// Setup the terminal WebSocket server
export function setupTerminalWebsocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/terminal'
  });
  
  logger.info('Setting up terminal WebSocket server');
  
  wss.on('connection', async (ws, req) => {
    try {
      // Get the project ID from query params
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const projectId = parseInt(url.searchParams.get('projectId') || '');
      
      if (isNaN(projectId)) {
        ws.close(1008, 'Missing or invalid projectId');
        return;
      }
      
      logger.info(`Terminal connection established for project ${projectId}`);
      
      // Create terminal info entry if it doesn't exist
      if (!terminalProcesses.has(projectId)) {
        terminalProcesses.set(projectId, {
          process: null,
          clients: new Set(),
          commandHistory: [],
          autocompleteSuggestions: [
            'ls', 'cd', 'mkdir', 'touch', 'cat', 'grep', 'find', 'echo',
            'npm', 'node', 'python', 'python3', 'git', 'curl', 'wget',
            'yarn', 'clear', 'exit', 'kill', 'ps', 'cp', 'mv', 'rm'
          ]
        });
      }
      
      const terminalInfo = terminalProcesses.get(projectId)!;
      terminalInfo.clients.add(ws);
      
      // Start the process if it's not already running
      if (!terminalInfo.process) {
        startProcess(projectId, terminalInfo);
      }
      
      // Handle messages from the client
      ws.on('message', (message) => {
        try {
          if (!terminalInfo.process) {
            // Try to restart the process if it's not running
            startProcess(projectId, terminalInfo);
            return;
          }
          
          const data = JSON.parse(message.toString());
          
          if (data.type === 'input') {
            // For Enter key presses (usually ending with \r), add to command history
            if (data.data.endsWith('\r')) {
              const command = data.data.trim().replace('\r', '');
              // Only store non-empty commands
              if (command && command.length > 0) {
                // Add to history if it's not a repeat of the last command
                if (terminalInfo.commandHistory.length === 0 || 
                    terminalInfo.commandHistory[terminalInfo.commandHistory.length - 1] !== command) {
                  terminalInfo.commandHistory.push(command);
                  // Limit history to last 100 commands
                  if (terminalInfo.commandHistory.length > 100) {
                    terminalInfo.commandHistory.shift();
                  }
                }
                
                // Update autocompleteSuggestions with new command if not already present
                if (!terminalInfo.autocompleteSuggestions.includes(command.split(' ')[0])) {
                  const baseCommand = command.split(' ')[0];
                  if (baseCommand && baseCommand.length > 1) {
                    terminalInfo.autocompleteSuggestions.push(baseCommand);
                  }
                }
              }
            }
            
            // Send input to the terminal process
            terminalInfo.process.stdin?.write(data.data);
          } else if (data.type === 'resize') {
            // Store the terminal dimensions for future reference
            const { cols, rows } = data;
            if (cols && rows) {
              logger.info(`Terminal resize: ${cols}x${rows} for project ${projectId}`);
              
              // Store dimensions in terminal info for potential reconnects
              terminalInfo.columns = cols;
              terminalInfo.rows = rows;
              
              // We can't directly resize a child_process terminal 
              // (only possible with proper PTY implementation),
              // but we can send terminal dimensions via STTY command
              if (terminalInfo.process && terminalInfo.process.stdin) {
                // Send STTY command to update the terminal size
                try {
                  const sttyCommand = `stty cols ${cols} rows ${rows}\n`;
                  terminalInfo.process.stdin.write(sttyCommand);
                } catch (err) {
                  logger.error(`Failed to resize terminal: ${err}`);
                }
              }
            }
          } else if (data.type === 'history_up' || data.type === 'history_down') {
            // Send command history to the client
            const index = data.index || 0;
            let historyCommand = '';
            
            if (data.type === 'history_up' && index < terminalInfo.commandHistory.length) {
              historyCommand = terminalInfo.commandHistory[terminalInfo.commandHistory.length - 1 - index];
            } else if (data.type === 'history_down' && index > 0) {
              historyCommand = terminalInfo.commandHistory[terminalInfo.commandHistory.length - index];
            }
            
            if (historyCommand) {
              ws.send(JSON.stringify({
                type: 'history',
                data: historyCommand,
                index: index
              }));
            }
          } else if (data.type === 'autocomplete') {
            // Handle tab completion
            const currentInput = data.text || '';
            const suggestions = terminalInfo.autocompleteSuggestions
              .filter(suggestion => suggestion.startsWith(currentInput))
              .slice(0, 10); // Limit to 10 suggestions
            
            if (suggestions.length > 0) {
              ws.send(JSON.stringify({
                type: 'autocomplete_suggestions',
                data: suggestions
              }));
            }
          }
        } catch (error) {
          logger.error(`Error handling terminal message: ${error}`);
        }
      });
      
      // Handle client disconnect
      ws.on('close', () => {
        logger.info(`Terminal client disconnected for project ${projectId}`);
        
        if (terminalInfo.clients) {
          terminalInfo.clients.delete(ws);
          
          // If no clients left, terminate the process
          if (terminalInfo.clients.size === 0) {
            stopProcess(projectId, terminalInfo);
          }
        }
      });
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        data: `Connected to terminal for project ${projectId}`
      }));
      
    } catch (error) {
      logger.error(`Error setting up terminal WebSocket: ${error}`);
      ws.close(1011, 'Internal error');
    }
  });
  
  return wss;
}

// Start a terminal process for a project
async function startProcess(projectId: number, terminalInfo: { 
  process: ChildProcess | null, 
  clients: Set<WebSocket>,
  commandHistory: string[],
  autocompleteSuggestions: string[],
  columns?: number,
  rows?: number
}) {
  try {
    // Get project details
    const project = await storage.getProject(projectId);
    
    if (!project) {
      broadcastToClients(terminalInfo.clients, {
        type: 'error',
        data: 'Project not found'
      });
      return;
    }
    
    // Get project files to determine the working directory
    const files = await storage.getFilesByProject(projectId);
    
    // Create a temporary directory for the project
    const projectDir = await createProjectDir(project, files);
    
    logger.info(`Starting terminal process for project ${projectId} in ${projectDir}`);
    
    // Determine which shell to use based on OS
    const shell = os.platform() === 'win32' ? 'cmd.exe' : 'bash';
    const args = os.platform() === 'win32' ? ['/K', 'cd', projectDir] : [];
    
    // Spawn the process
    const termProcess = spawn(shell, args, {
      cwd: projectDir,
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Store the process
    terminalInfo.process = termProcess;
    
    // Apply terminal dimensions if they were previously set
    if (terminalInfo.columns && terminalInfo.rows && termProcess.stdin) {
      try {
        const sttyCommand = `stty cols ${terminalInfo.columns} rows ${terminalInfo.rows}\n`;
        termProcess.stdin.write(sttyCommand);
      } catch (err) {
        logger.error(`Failed to apply terminal dimensions on start: ${err}`);
      }
    }
    
    // Handle process output
    termProcess.stdout.on('data', (data: Buffer) => {
      broadcastToClients(terminalInfo.clients, {
        type: 'output',
        data: data.toString()
      });
    });
    
    termProcess.stderr.on('data', (data: Buffer) => {
      broadcastToClients(terminalInfo.clients, {
        type: 'output',
        data: data.toString()
      });
    });
    
    // Handle process exit
    termProcess.on('exit', (code: number | null) => {
      logger.info(`Terminal process exited with code ${code} for project ${projectId}`);
      
      broadcastToClients(terminalInfo.clients, {
        type: 'exit',
        data: `Process exited with code ${code}`
      });
      
      terminalInfo.process = null;
    });
    
    // Notify clients that the process has started
    broadcastToClients(terminalInfo.clients, {
      type: 'started',
      data: `Terminal started in ${projectDir}`
    });
    
  } catch (error) {
    logger.error(`Error starting terminal process: ${error}`);
    
    broadcastToClients(terminalInfo.clients, {
      type: 'error',
      data: `Failed to start terminal: ${error}`
    });
    
    terminalInfo.process = null;
  }
}

// Stop a terminal process
function stopProcess(projectId: number, terminalInfo: { 
  process: ChildProcess | null, 
  clients: Set<WebSocket>,
  commandHistory: string[],
  autocompleteSuggestions: string[],
  columns?: number,
  rows?: number
}) {
  if (terminalInfo.process) {
    logger.info(`Stopping terminal process for project ${projectId}`);
    
    // Kill the process
    terminalInfo.process.kill();
    terminalInfo.process = null;
    
    // Notify clients
    broadcastToClients(terminalInfo.clients, {
      type: 'stopped',
      data: 'Terminal stopped'
    });
  }
}

// Message types
interface TerminalMessage {
  type: 'output' | 'connected' | 'error' | 'exit' | 'started' | 'stopped' | 'history' | 'autocomplete_suggestions';
  data: string | string[];
  index?: number;
}

// Broadcast a message to all connected clients
function broadcastToClients(clients: Set<WebSocket>, message: TerminalMessage): void {
  const messageStr = JSON.stringify(message);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// Create a temporary project directory with all project files
async function createProjectDir(project: { id: number }, files: File[]): Promise<string> {
  const projectDir = path.join(os.tmpdir(), `plot-terminal-${project.id}`);
  
  try {
    // Create directory if it doesn't exist
    await fs.promises.mkdir(projectDir, { recursive: true });
    
    // Write all files to the directory
    for (const file of files) {
      if (file.isFolder) {
        await fs.promises.mkdir(path.join(projectDir, file.name), { recursive: true });
      } else {
        await fs.promises.writeFile(
          path.join(projectDir, file.name),
          file.content || '',
          'utf8'
        );
      }
    }
    
    return projectDir;
  } catch (error) {
    logger.error(`Error creating project directory: ${error}`);
    throw error;
  }
}