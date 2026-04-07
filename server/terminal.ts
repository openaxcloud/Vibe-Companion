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

const logger = createLogger('terminal');

const terminalProcesses = new Map<number, {
  process: ChildProcess | null;
  clients: Set<WebSocket>;
  commandHistory: string[];
  autocompleteSuggestions: string[];
  columns?: number;
  rows?: number;
}>();

export function setupTerminalWebsocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/terminal'
  });
  
  logger.info('Setting up terminal WebSocket server');
  
  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const projectId = parseInt(url.searchParams.get('projectId') || '');
      
      if (isNaN(projectId)) {
        ws.close(1008, 'Missing or invalid projectId');
        return;
      }
      
      logger.info(`Terminal connection established for project ${projectId}`);
      
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
      
      if (!terminalInfo.process) {
        startProcess(projectId, terminalInfo);
      }
      
      ws.on('message', (message) => {
        try {
          if (!terminalInfo.process) {
            startProcess(projectId, terminalInfo);
            return;
          }
          
          const data = JSON.parse(message.toString());
          
          if (data.type === 'input') {
            if (data.data.endsWith('\r')) {
              const command = data.data.trim().replace('\r', '');
              if (command && command.length > 0) {
                if (terminalInfo.commandHistory.length === 0 || 
                    terminalInfo.commandHistory[terminalInfo.commandHistory.length - 1] !== command) {
                  terminalInfo.commandHistory.push(command);
                  if (terminalInfo.commandHistory.length > 100) {
                    terminalInfo.commandHistory.shift();
                  }
                }
                
                if (!terminalInfo.autocompleteSuggestions.includes(command.split(' ')[0])) {
                  const baseCommand = command.split(' ')[0];
                  if (baseCommand && baseCommand.length > 1) {
                    terminalInfo.autocompleteSuggestions.push(baseCommand);
                  }
                }
              }
            }
            
            terminalInfo.process.stdin?.write(data.data);
          } else if (data.type === 'resize') {
            const { cols, rows } = data;
            if (cols && rows) {
              logger.info(`Terminal resize: ${cols}x${rows} for project ${projectId}`);
              terminalInfo.columns = cols;
              terminalInfo.rows = rows;
              
              if (terminalInfo.process && terminalInfo.process.stdin) {
                try {
                  const sttyCommand = `stty cols ${cols} rows ${rows}\n`;
                  terminalInfo.process.stdin.write(sttyCommand);
                } catch (err) {
                  logger.error(`Failed to resize terminal: ${err}`);
                }
              }
            }
          } else if (data.type === 'history_up' || data.type === 'history_down') {
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
            const currentInput = data.text || '';
            const suggestions = terminalInfo.autocompleteSuggestions
              .filter(suggestion => suggestion.startsWith(currentInput))
              .slice(0, 10);
            
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
      
      ws.on('close', () => {
        logger.info(`Terminal client disconnected for project ${projectId}`);
        
        if (terminalInfo.clients) {
          terminalInfo.clients.delete(ws);
          
          if (terminalInfo.clients.size === 0) {
            stopProcess(projectId, terminalInfo);
          }
        }
      });
      
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

type TerminalInfo = {
  process: ChildProcess | null;
  clients: Set<WebSocket>;
  commandHistory: string[];
  autocompleteSuggestions: string[];
  columns?: number;
  rows?: number;
};

async function startProcess(projectId: number, terminalInfo: TerminalInfo) {
  try {
    const project = await storage.getProject(projectId);
    
    if (!project) {
      broadcastToClients(terminalInfo.clients, {
        type: 'error',
        data: 'Project not found'
      });
      return;
    }
    
    const files = await storage.getFilesByProject(projectId);
    const projectDir = await createProjectDir(project, files);
    
    logger.info(`Starting terminal process for project ${projectId} in ${projectDir}`);
    
    const shell = os.platform() === 'win32' ? 'cmd.exe' : 'bash';
    const args = os.platform() === 'win32' ? ['/K', 'cd', projectDir] : [];
    
    const termProcess = spawn(shell, args, {
      cwd: projectDir,
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    terminalInfo.process = termProcess;
    
    termProcess.stdout?.on('data', (data: Buffer) => {
      broadcastToClients(terminalInfo.clients, {
        type: 'output',
        data: data.toString()
      });
    });
    
    termProcess.stderr?.on('data', (data: Buffer) => {
      broadcastToClients(terminalInfo.clients, {
        type: 'output',
        data: data.toString()
      });
    });
    
    termProcess.on('exit', (code) => {
      logger.info(`Terminal process exited with code ${code} for project ${projectId}`);
      
      broadcastToClients(terminalInfo.clients, {
        type: 'exit',
        data: `Process exited with code ${code}`
      });
      
      terminalInfo.process = null;
    });
    
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

function stopProcess(projectId: number, terminalInfo: TerminalInfo) {
  if (terminalInfo.process) {
    logger.info(`Stopping terminal process for project ${projectId}`);
    
    terminalInfo.process.kill();
    terminalInfo.process = null;
    
    broadcastToClients(terminalInfo.clients, {
      type: 'stopped',
      data: 'Terminal stopped'
    });
  }
}

function broadcastToClients(clients: Set<WebSocket>, message: any) {
  const messageStr = JSON.stringify(message);
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

async function createProjectDir(project: { id: number | string }, files: File[]): Promise<string> {
  const projectDir = path.join(os.tmpdir(), `plot-terminal-${project.id}`);
  
  try {
    await fs.promises.mkdir(projectDir, { recursive: true });
    
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
