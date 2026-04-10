/**
 * Plan Generator Service
 * 
 * Generates strategic plans before autonomous execution:
 * 1. Analyzes user requirements
 * 2. Breaks down into sequential tasks
 * 3. Identifies dependencies between tasks
 * 4. Estimates effort and time
 * 5. Suggests optimal execution order
 * 
 * This enables "Plan Mode" - a core Phase 1 feature for Replit AI Agent V3 parity.
 */

import { EventEmitter } from 'events';
import { OpenAI } from 'openai';
import { createLogger } from '../utils/logger';

const logger = createLogger('PlanGenerator');

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'file_operation' | 'command' | 'database' | 'configuration' | 'testing' | 'deployment';
  estimatedMinutes: number;
  riskScore: number;
  dependencies: string[]; // Task IDs this depends on
  requiredTools: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  tasks: Task[];
  totalEstimatedMinutes: number;
  parallelizableTasks: string[][]; // Groups of tasks that can run in parallel
  criticalPath: string[]; // Task IDs in order of critical path
  riskAssessment: {
    overallRisk: number;
    highRiskTasks: string[];
    mitigationStrategies: string[];
  };
  alternativeApproaches: string[];
  createdAt: Date;
  ownerUserId?: string; // User who created/owns this plan
}

export class PlanGeneratorService extends EventEmitter {
  private openai: OpenAI;
  private planCache: Map<string, ExecutionPlan> = new Map();

  constructor() {
    super();
    
    // Initialize OpenAI with Replit AI Integrations
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'replit',
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    });
    
    logger.info('Plan Generator initialized');
  }

  /**
   * Generate a strategic execution plan from user requirements
   */
  async generatePlan(
    goal: string,
    context: {
      projectType?: string;
      existingFiles?: string[];
      technologies?: string[];
      constraints?: string[];
      userId?: string; // Owner of the plan
    } = {}
  ): Promise<ExecutionPlan> {
    try {
      logger.info(`Generating plan for goal: ${goal}`);
      
      // Use AI to break down the goal into tasks
      const tasks = await this.breakDownGoal(goal, context);
      
      // Analyze dependencies
      const dependencyGraph = this.analyzeDependencies(tasks);
      
      // Calculate critical path
      const criticalPath = this.calculateCriticalPath(tasks, dependencyGraph);
      
      // Identify parallelizable tasks
      const parallelizableTasks = this.findParallelizableTasks(tasks, dependencyGraph);
      
      // Assess overall risk
      const riskAssessment = this.assessPlanRisk(tasks);
      
      // Generate alternative approaches
      const alternativeApproaches = await this.generateAlternatives(goal, tasks, context);
      
      const plan: ExecutionPlan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        goal,
        tasks,
        totalEstimatedMinutes: tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
        parallelizableTasks,
        criticalPath,
        riskAssessment,
        alternativeApproaches,
        createdAt: new Date(),
        ownerUserId: context.userId // Store ownership
      };
      
      // Cache the plan
      this.planCache.set(plan.id, plan);
      
      this.emit('plan_generated', plan);
      logger.info(`Plan generated with ${tasks.length} tasks, estimated ${plan.totalEstimatedMinutes} minutes`);
      
      return plan;
    } catch (error) {
      logger.error('Error generating plan:', error);
      throw error;
    }
  }

  /**
   * Break down a goal into executable tasks using AI
   */
  private async breakDownGoal(
    goal: string,
    context: any
  ): Promise<Task[]> {
    const systemPrompt = `You are an expert software architect and project planner. Break down complex software development goals into concrete, executable tasks.

For each task, provide:
1. Clear title and description
2. Task type (file_operation, command, database, configuration, testing, deployment)
3. Estimated time in minutes
4. Risk score (0-100)
5. Dependencies (which other tasks must complete first)
6. Required tools
7. Priority level

Output as JSON array of tasks.`;

    const userPrompt = `Goal: ${goal}

Context:
- Project Type: ${context.projectType || 'web application'}
- Existing Files: ${context.existingFiles?.slice(0, 20).join(', ') || 'none'}
- Technologies: ${context.technologies?.join(', ') || 'not specified'}
- Constraints: ${context.constraints?.join(', ') || 'none'}

Break this down into a step-by-step execution plan. Be specific and actionable.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content || '[]';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('AI did not return valid JSON, generating fallback tasks');
        return this.generateFallbackTasks(goal);
      }

      const aiTasks = JSON.parse(jsonMatch[0]);
      
      // Convert AI response to Task objects
      return aiTasks.map((task: any, index: number) => ({
        id: `task-${index + 1}`,
        title: task.title || `Task ${index + 1}`,
        description: task.description || '',
        type: this.normalizeTaskType(task.type),
        estimatedMinutes: task.estimatedMinutes || 15,
        riskScore: task.riskScore || 30,
        dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
        requiredTools: Array.isArray(task.requiredTools) ? task.requiredTools : [],
        priority: this.normalizePriority(task.priority)
      }));
    } catch (error) {
      logger.error('Error calling AI for task breakdown:', error);
      return this.generateFallbackTasks(goal);
    }
  }

  /**
   * Analyze dependencies between tasks
   */
  private analyzeDependencies(tasks: Task[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // ✅ FIX (Dec 27, 2025): Default to empty array if dependencies undefined
    tasks.forEach(task => {
      graph.set(task.id, task.dependencies || []);
    });
    
    return graph;
  }

  /**
   * Calculate critical path through task dependency graph
   */
  private calculateCriticalPath(tasks: Task[], dependencies: Map<string, string[]>): string[] {
    const path: string[] = [];
    const visited = new Set<string>();
    
    // Find tasks with no dependencies (entry points)
    // ✅ FIX (Dec 27, 2025): Use optional chaining - AI-generated tasks may omit dependencies
    const entryTasks = tasks.filter(task => !task.dependencies?.length);
    
    // Simple DFS to find longest path (critical path)
    const findLongestPath = (taskId: string, currentPath: string[]): string[] => {
      if (visited.has(taskId)) return currentPath;
      visited.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return currentPath;
      
      currentPath.push(taskId);
      
      // Find dependent tasks
      // ✅ FIX (Dec 27, 2025): Use optional chaining - AI-generated tasks may omit dependencies
      const dependents = tasks.filter(t => t.dependencies?.includes(taskId));
      
      if (dependents.length === 0) {
        return currentPath;
      }
      
      // Recursively find longest path through dependents
      let longestPath = currentPath;
      dependents.forEach(dependent => {
        const path = findLongestPath(dependent.id, [...currentPath]);
        if (path.length > longestPath.length) {
          longestPath = path;
        }
      });
      
      return longestPath;
    };
    
    // Find longest path from each entry point
    let criticalPath: string[] = [];
    entryTasks.forEach(task => {
      visited.clear();
      const path = findLongestPath(task.id, []);
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    });
    
    return criticalPath;
  }

  /**
   * Find groups of tasks that can run in parallel
   */
  private findParallelizableTasks(tasks: Task[], dependencies: Map<string, string[]>): string[][] {
    const groups: string[][] = [];
    const processed = new Set<string>();
    
    // Group tasks by dependency depth
    const depthMap = new Map<number, string[]>();
    
    tasks.forEach(task => {
      const depth = this.calculateTaskDepth(task.id, dependencies, tasks);
      if (!depthMap.has(depth)) {
        depthMap.set(depth, []);
      }
      depthMap.get(depth)!.push(task.id);
    });
    
    // Convert depth groups to parallel groups
    Array.from(depthMap.keys()).sort().forEach(depth => {
      const taskIds = depthMap.get(depth) || [];
      if (taskIds.length > 1) {
        groups.push(taskIds);
      }
    });
    
    return groups;
  }

  /**
   * Calculate depth of a task in dependency tree
   */
  private calculateTaskDepth(taskId: string, dependencies: Map<string, string[]>, tasks: Task[]): number {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.dependencies.length) return 0;
    
    const depths = task.dependencies.map(depId => 
      this.calculateTaskDepth(depId, dependencies, tasks)
    );
    
    return Math.max(...depths) + 1;
  }

  /**
   * Assess overall risk of the plan
   */
  private assessPlanRisk(tasks: Task[]): ExecutionPlan['riskAssessment'] {
    const totalRisk = tasks.reduce((sum, task) => sum + task.riskScore, 0);
    const avgRisk = totalRisk / tasks.length;
    
    const highRiskTasks = tasks
      .filter(task => task.riskScore >= 60)
      .map(task => task.id);
    
    const mitigationStrategies = [];
    
    if (highRiskTasks.length > 0) {
      mitigationStrategies.push('Create checkpoints before high-risk tasks');
      mitigationStrategies.push('Enable rollback for critical operations');
    }
    
    if (avgRisk > 50) {
      mitigationStrategies.push('Increase testing coverage');
      mitigationStrategies.push('Consider staging environment for validation');
    }
    
    const hasDeployment = tasks.some(t => t.type === 'deployment');
    if (hasDeployment) {
      mitigationStrategies.push('Use blue-green deployment strategy');
    }
    
    return {
      overallRisk: Math.round(avgRisk),
      highRiskTasks,
      mitigationStrategies
    };
  }

  /**
   * Generate alternative approaches using AI
   */
  private async generateAlternatives(
    goal: string,
    tasks: Task[],
    context: any
  ): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4.1',
        messages: [
          {
            role: 'system',
            content: 'You are a software architect. Suggest 2-3 alternative approaches to achieve the same goal.'
          },
          {
            role: 'user',
            content: `Goal: ${goal}\n\nCurrent approach has ${tasks.length} tasks. What are alternative ways to achieve this?`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content || '';
      const alternatives = content
        .split('\n')
        .filter(line => line.trim().length > 20)
        .slice(0, 3);
      
      return alternatives.length > 0 ? alternatives : [
        'Consider using a framework/library that provides this functionality out-of-the-box',
        'Break the implementation into smaller, incremental releases'
      ];
    } catch (error) {
      logger.error('Error generating alternatives:', error);
      return ['Iterative approach with frequent testing'];
    }
  }

  /**
   * Get a plan by ID
   */
  getPlan(planId: string): ExecutionPlan | undefined {
    return this.planCache.get(planId);
  }

  /**
   * Get a plan with ownership verification
   * Returns the plan only if it belongs to the specified user
   */
  getPlanForUser(planId: string, userId: string): ExecutionPlan | undefined {
    const plan = this.planCache.get(planId);
    
    if (!plan) {
      return undefined;
    }
    
    // If plan has no owner (legacy plans), allow access
    // Otherwise, verify ownership
    if (plan.ownerUserId && plan.ownerUserId !== userId) {
      return undefined;
    }
    
    return plan;
  }

  /**
   * Update task status in a plan
   */
  updateTaskStatus(planId: string, taskId: string, status: 'completed' | 'failed' | 'in_progress'): void {
    const plan = this.planCache.get(planId);
    if (plan) {
      this.emit('task_status_updated', { planId, taskId, status });
    }
  }

  // Helper methods

  private generateFallbackTasks(goal: string): Task[] {
    return [
      {
        id: 'task-1',
        title: 'Analyze requirements',
        description: `Understand and document requirements for: ${goal}`,
        type: 'file_operation',
        estimatedMinutes: 10,
        riskScore: 10,
        dependencies: [],
        requiredTools: ['read_file', 'write_file'],
        priority: 'high'
      },
      {
        id: 'task-2',
        title: 'Implement core functionality',
        description: 'Build the main features',
        type: 'file_operation',
        estimatedMinutes: 30,
        riskScore: 40,
        dependencies: ['task-1'],
        requiredTools: ['write_file', 'run_command'],
        priority: 'high'
      },
      {
        id: 'task-3',
        title: 'Test and validate',
        description: 'Ensure everything works correctly',
        type: 'testing',
        estimatedMinutes: 15,
        riskScore: 20,
        dependencies: ['task-2'],
        requiredTools: ['run_test', 'read_file'],
        priority: 'high'
      }
    ];
  }

  private normalizeTaskType(type: string): Task['type'] {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('file')) return 'file_operation';
    if (lowerType.includes('command') || lowerType.includes('execute')) return 'command';
    if (lowerType.includes('database') || lowerType.includes('db')) return 'database';
    if (lowerType.includes('config')) return 'configuration';
    if (lowerType.includes('test')) return 'testing';
    if (lowerType.includes('deploy')) return 'deployment';
    return 'file_operation';
  }

  private normalizePriority(priority: string): Task['priority'] {
    const lowerPriority = priority?.toLowerCase() || '';
    if (lowerPriority.includes('critical')) return 'critical';
    if (lowerPriority.includes('high')) return 'high';
    if (lowerPriority.includes('low')) return 'low';
    return 'medium';
  }
}

// Singleton instance
export const planGenerator = new PlanGeneratorService();
