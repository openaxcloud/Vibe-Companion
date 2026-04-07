import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = createLogger('simple-workflow-runner');

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'command' | 'script' | 'deploy' | 'test';
  command?: string;
  script?: string;
  config?: Record<string, any>;
}

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'manual' | 'push' | 'schedule' | 'webhook';
    config?: {
      branch?: string;
      cron?: string;
      url?: string;
    };
  };
  steps: WorkflowStep[];
  enabled: boolean;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
  trigger: string;
  currentStep?: string;
}

export class SimpleWorkflowRunner {
  private workflows: Map<string, WorkflowConfig> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  
  constructor() {
    // Initialize with some default workflows
    this.initializeDefaultWorkflows();
  }
  
  private initializeDefaultWorkflows() {
    const cicdWorkflow: WorkflowConfig = {
      id: 'default-cicd',
      name: 'CI/CD Pipeline',
      description: 'Build, test, and deploy on push',
      trigger: {
        type: 'manual',
        config: { branch: 'main' }
      },
      steps: [
        { id: '1', name: 'Install Dependencies', type: 'command', command: 'npm install' },
        { id: '2', name: 'Run Tests', type: 'command', command: 'npm test' },
        { id: '3', name: 'Build', type: 'command', command: 'npm run build' }
      ],
      enabled: true
    };
    
    this.workflows.set(cicdWorkflow.id, cicdWorkflow);
  }
  
  async getWorkflows(projectId: string): Promise<WorkflowConfig[]> {
    return Array.from(this.workflows.values());
  }
  
  async createWorkflow(projectId: string, workflow: Omit<WorkflowConfig, 'id'>): Promise<WorkflowConfig> {
    const id = `workflow-${projectId}-${Date.now()}`;
    const newWorkflow: WorkflowConfig = {
      ...workflow,
      id
    };
    
    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }
  
  async runWorkflow(workflowId: string, projectId: string): Promise<WorkflowRun> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    if (!workflow.enabled) {
      throw new Error('Workflow is disabled');
    }
    
    const runId = `run-${workflowId}-${Date.now()}`;
    const run: WorkflowRun = {
      id: runId,
      workflowId,
      status: 'running',
      startedAt: new Date(),
      logs: [`Starting workflow: ${workflow.name}`],
      trigger: 'manual'
    };
    
    this.runs.set(runId, run);
    
    // Execute workflow asynchronously
    this.executeWorkflow(run, workflow, projectId);
    
    return run;
  }
  
  private async executeWorkflow(run: WorkflowRun, workflow: WorkflowConfig, projectId: string) {
    const projectDir = path.join(process.cwd(), 'projects', projectId);
    
    try {
      for (const step of workflow.steps) {
        run.currentStep = step.name;
        run.logs.push(`\n=== Executing step: ${step.name} ===`);
        
        try {
          if (step.type === 'command' && step.command) {
            run.logs.push(`Running command: ${step.command}`);
            
            // Execute command in project directory
            const { stdout, stderr } = await execAsync(step.command, {
              cwd: projectDir,
              env: { ...process.env, CI: 'true' }
            });
            
            if (stdout) run.logs.push(stdout);
            if (stderr) run.logs.push(`[stderr] ${stderr}`);
            
            run.logs.push(`✓ Step completed: ${step.name}`);
          } else if (step.type === 'script' && step.script) {
            run.logs.push(`Running script...`);
            run.logs.push(step.script);
            run.logs.push(`✓ Script executed: ${step.name}`);
          }
          
          // Log step completion
          logger.info(`Workflow step completed: ${step.name}`);
          
        } catch (stepError: any) {
          run.logs.push(`✗ Step failed: ${step.name}`);
          run.logs.push(`Error: ${stepError.message}`);
          throw stepError;
        }
      }
      
      run.status = 'success';
      run.logs.push(`\n✓ Workflow completed successfully!`);
      
    } catch (error: any) {
      run.status = 'failed';
      run.logs.push(`\n✗ Workflow failed: ${error.message}`);
      logger.error('Workflow execution failed:', error);
    } finally {
      run.completedAt = new Date();
      delete run.currentStep;
    }
  }
  
  async getWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    return Array.from(this.runs.values())
      .filter(run => run.workflowId === workflowId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  
  async getRunStatus(runId: string): Promise<WorkflowRun | null> {
    return this.runs.get(runId) || null;
  }
  
  async updateWorkflow(workflowId: string, updates: Partial<WorkflowConfig>): Promise<WorkflowConfig> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    const updatedWorkflow = {
      ...workflow,
      ...updates,
      id: workflowId // Ensure ID doesn't change
    };
    
    this.workflows.set(workflowId, updatedWorkflow);
    return updatedWorkflow;
  }
  
  async deleteWorkflow(workflowId: string): Promise<void> {
    this.workflows.delete(workflowId);
  }
}

export const simpleWorkflowRunner = new SimpleWorkflowRunner();