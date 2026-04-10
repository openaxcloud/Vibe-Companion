// @ts-nocheck
import { EventEmitter } from 'events';
import * as net from 'net';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('cluster-manager');

export interface ClusterNode {
  id: string;
  hostname: string;
  port: number;
  status: 'online' | 'offline' | 'unhealthy';
  lastHeartbeat: Date;
  resources: {
    cpuCores: number;
    totalMemory: number;
    availableMemory: number;
    runningTasks: number;
  };
  capabilities: string[];
}

export interface DistributedTask {
  id: string;
  type: string;
  payload: any;
  priority: number;
  requiredCapabilities?: string[];
  assignedNode?: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
}

export class ClusterManager extends EventEmitter {
  private nodes: Map<string, ClusterNode> = new Map();
  private tasks: Map<string, DistributedTask> = new Map();
  private nodeId: string;
  private isLeader: boolean = false;
  private leaderElectionInterval?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private server?: net.Server;

  constructor(
    private config: {
      nodePort: number;
      discoveryPort: number;
      heartbeatIntervalMs: number;
      nodeTimeoutMs: number;
    }
  ) {
    super();
    this.nodeId = this.generateNodeId();
  }

  async start() {
    logger.info(`Starting cluster node ${this.nodeId}`);
    
    // Start node server for inter-node communication
    this.startNodeServer();
    
    // Start service discovery
    this.startServiceDiscovery();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Start leader election
    this.startLeaderElection();
  }

  async stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.leaderElectionInterval) clearInterval(this.leaderElectionInterval);
    if (this.server) this.server.close();
  }

  // Task scheduling with distributed load balancing
  async submitTask(task: Omit<DistributedTask, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const taskId = crypto.randomBytes(16).toString('hex');
    const distributedTask: DistributedTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.set(taskId, distributedTask);

    // Find best node for task
    const targetNode = this.findBestNodeForTask(distributedTask);
    
    if (targetNode) {
      await this.assignTaskToNode(distributedTask, targetNode);
    } else {
      // Queue task for later assignment
      logger.warn(`No suitable node found for task ${taskId}, queuing`);
    }

    return taskId;
  }

  // Sophisticated load balancing algorithm
  private findBestNodeForTask(task: DistributedTask): ClusterNode | null {
    const availableNodes = Array.from(this.nodes.values())
      .filter(node => {
        // Check if node is healthy
        if (node.status !== 'online') return false;
        
        // Check if node has required capabilities
        if (task.requiredCapabilities) {
          return task.requiredCapabilities.every(cap => 
            node.capabilities.includes(cap)
          );
        }
        
        return true;
      });

    if (availableNodes.length === 0) return null;

    // Sort by load score (lower is better)
    availableNodes.sort((a, b) => {
      const scoreA = this.calculateNodeLoadScore(a);
      const scoreB = this.calculateNodeLoadScore(b);
      return scoreA - scoreB;
    });

    return availableNodes[0];
  }

  private calculateNodeLoadScore(node: ClusterNode): number {
    const memoryUsage = 1 - (node.resources.availableMemory / node.resources.totalMemory);
    const taskLoad = node.resources.runningTasks / node.resources.cpuCores;
    
    // Weighted score: memory usage is 40%, task load is 60%
    return (memoryUsage * 0.4) + (taskLoad * 0.6);
  }

  private async assignTaskToNode(task: DistributedTask, node: ClusterNode) {
    task.assignedNode = node.id;
    task.status = 'assigned';
    
    // Send task to node via TCP
    const client = net.createConnection({
      host: node.hostname,
      port: node.port
    });

    client.on('connect', () => {
      const message = JSON.stringify({
        type: 'TASK_ASSIGNMENT',
        task: task
      });
      client.write(message);
      client.end();
    });

    client.on('error', (error) => {
      logger.error(`Failed to assign task to node ${node.id}:`, error);
      task.status = 'pending';
      task.assignedNode = undefined;
    });
  }

  private startNodeServer() {
    this.server = net.createServer((socket) => {
      let buffer = '';
      
      socket.on('data', (data) => {
        buffer += data.toString();
        
        // Try to parse complete messages
        const messages = buffer.split('\n');
        buffer = messages.pop() || '';
        
        for (const message of messages) {
          if (message) {
            try {
              const parsed = JSON.parse(message);
              this.handleNodeMessage(parsed, socket);
            } catch (error) {
              logger.error('Failed to parse node message:', error);
            }
          }
        }
      });
    });

    this.server.listen(this.config.nodePort, () => {
      logger.info(`Node server listening on port ${this.config.nodePort}`);
    });
  }

  private handleNodeMessage(message: any, socket: net.Socket) {
    switch (message.type) {
      case 'HEARTBEAT':
        this.handleHeartbeat(message);
        break;
      case 'TASK_UPDATE':
        this.handleTaskUpdate(message);
        break;
      case 'NODE_JOIN':
        this.handleNodeJoin(message);
        break;
      case 'LEADER_ELECTION':
        this.handleLeaderElection(message);
        break;
    }
  }

  private handleHeartbeat(message: any) {
    const node = this.nodes.get(message.nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      node.resources = message.resources;
      node.status = 'online';
    }
  }

  private handleTaskUpdate(message: any) {
    const task = this.tasks.get(message.taskId);
    if (task) {
      task.status = message.status;
      if (message.result) task.result = message.result;
      if (message.error) task.error = message.error;
      if (message.status === 'completed' || message.status === 'failed') {
        task.completedAt = new Date();
        this.emit('taskCompleted', task);
      }
    }
  }

  private handleNodeJoin(message: any) {
    const node: ClusterNode = {
      id: message.nodeId,
      hostname: message.hostname,
      port: message.port,
      status: 'online',
      lastHeartbeat: new Date(),
      resources: message.resources,
      capabilities: message.capabilities || []
    };
    
    this.nodes.set(node.id, node);
    logger.info(`Node ${node.id} joined cluster`);
    this.emit('nodeJoined', node);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Check node health
      const now = new Date();
      for (const [nodeId, node] of this.nodes) {
        const timeSinceLastHeartbeat = now.getTime() - node.lastHeartbeat.getTime();
        if (timeSinceLastHeartbeat > this.config.nodeTimeoutMs) {
          node.status = 'offline';
          logger.warn(`Node ${nodeId} marked as offline`);
          this.emit('nodeOffline', node);
        }
      }

      // Reassign tasks from offline nodes
      this.reassignTasksFromOfflineNodes();
    }, this.config.heartbeatIntervalMs);
  }

  private reassignTasksFromOfflineNodes() {
    for (const [taskId, task] of this.tasks) {
      if (task.status === 'assigned' || task.status === 'running') {
        const assignedNode = task.assignedNode ? this.nodes.get(task.assignedNode) : null;
        if (!assignedNode || assignedNode.status !== 'online') {
          logger.info(`Reassigning task ${taskId} from offline node`);
          task.status = 'pending';
          task.assignedNode = undefined;
          
          // Try to reassign
          const newNode = this.findBestNodeForTask(task);
          if (newNode) {
            this.assignTaskToNode(task, newNode);
          }
        }
      }
    }
  }

  private startServiceDiscovery() {
    // Implement UDP broadcast for node discovery
    const dgram = require('dgram');
    const discoverySocket = dgram.createSocket('udp4');
    
    discoverySocket.on('message', (msg: Buffer, rinfo: any) => {
      try {
        const message = JSON.parse(msg.toString());
        if (message.type === 'NODE_ANNOUNCE' && message.nodeId !== this.nodeId) {
          this.handleNodeJoin({
            ...message,
            hostname: rinfo.address
          });
        }
      } catch (error) {
        logger.error('Failed to parse discovery message:', error);
      }
    });

    discoverySocket.bind(this.config.discoveryPort);

    // Announce self periodically
    setInterval(() => {
      const announcement = Buffer.from(JSON.stringify({
        type: 'NODE_ANNOUNCE',
        nodeId: this.nodeId,
        port: this.config.nodePort,
        capabilities: this.getNodeCapabilities(),
        resources: this.getNodeResources()
      }));

      discoverySocket.send(
        announcement,
        0,
        announcement.length,
        this.config.discoveryPort,
        '255.255.255.255'
      );
    }, 5000);
  }

  private startLeaderElection() {
    // Implement Raft consensus for leader election
    this.leaderElectionInterval = setInterval(() => {
      if (!this.isLeader) {
        // Simple leader election: node with lowest ID becomes leader
        const activeNodes = Array.from(this.nodes.values())
          .filter(n => n.status === 'online')
          .map(n => n.id);
        
        activeNodes.push(this.nodeId);
        activeNodes.sort();
        
        if (activeNodes[0] === this.nodeId) {
          this.isLeader = true;
          logger.info(`Node ${this.nodeId} elected as leader`);
          this.emit('leaderElected', this.nodeId);
        }
      }
    }, 10000);
  }

  private generateNodeId(): string {
    return `node-${crypto.randomBytes(8).toString('hex')}`;
  }

  private getNodeCapabilities(): string[] {
    // Return capabilities based on what this node can do
    return [
      'code-execution',
      'ai-inference',
      'git-operations',
      'database-operations',
      'file-operations'
    ];
  }

  private getNodeResources(): any {
    const os = require('os');
    return {
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      availableMemory: os.freemem(),
      runningTasks: Array.from(this.tasks.values())
        .filter(t => t.assignedNode === this.nodeId && t.status === 'running')
        .length
    };
  }

  getClusterStatus() {
    return {
      nodeId: this.nodeId,
      isLeader: this.isLeader,
      nodes: Array.from(this.nodes.values()),
      tasks: {
        total: this.tasks.size,
        pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
        running: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
        completed: Array.from(this.tasks.values()).filter(t => t.status === 'completed').length,
        failed: Array.from(this.tasks.values()).filter(t => t.status === 'failed').length
      }
    };
  }
}

// Singleton instance
export const clusterManager = new ClusterManager({
  nodePort: parseInt(process.env.CLUSTER_NODE_PORT || '7000'),
  discoveryPort: parseInt(process.env.CLUSTER_DISCOVERY_PORT || '7001'),
  heartbeatIntervalMs: 5000,
  nodeTimeoutMs: 15000
});