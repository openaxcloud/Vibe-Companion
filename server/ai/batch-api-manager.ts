/**
 * OpenAI Batch API Manager - 50% Cost Reduction for Non-Urgent Tasks
 * 
 * Implements OpenAI's Batch API for:
 * - Background code generation tasks
 * - Bulk documentation generation
 * - Non-time-sensitive AI operations
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 2025
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('batch-api-manager');

export interface BatchTask {
  id: string;
  customId: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  priority: 'low' | 'normal';
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  result?: string;
  error?: string;
  costSaved?: number;
}

export interface BatchJob {
  id: string;
  openAiBatchId?: string;
  tasks: BatchTask[];
  status: 'pending' | 'submitted' | 'in_progress' | 'completed' | 'failed' | 'expired';
  createdAt: number;
  submittedAt?: number;
  completedAt?: number;
  totalCostSaved: number;
}

export interface BatchMetrics {
  totalBatchJobs: number;
  completedBatchJobs: number;
  failedBatchJobs: number;
  totalTasksProcessed: number;
  totalCostSaved: number;
  averageCompletionTime: number;
  pendingTasks: number;
}

const BATCH_SIZE_THRESHOLD = 5;
const BATCH_TIMEOUT_MS = 60000;
const BATCH_TEMP_DIR = '/tmp/batch-api';

class BatchAPIManager {
  private openaiClient: OpenAI | null = null;
  private pendingTasks: Map<string, BatchTask> = new Map();
  private batchJobs: Map<string, BatchJob> = new Map();
  private taskCallbacks: Map<string, (result: string | null, error?: string) => void> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private metrics: BatchMetrics = {
    totalBatchJobs: 0,
    completedBatchJobs: 0,
    failedBatchJobs: 0,
    totalTasksProcessed: 0,
    totalCostSaved: 0,
    averageCompletionTime: 0,
    pendingTasks: 0,
  };

  constructor() {
    this.initializeClient();
    this.ensureTempDir();
  }

  private initializeClient(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openaiClient = new OpenAI({ apiKey });
      logger.info('OpenAI Batch API client initialized');
    } else {
      logger.warn('OpenAI API key not found - Batch API disabled');
    }
  }

  private ensureTempDir(): void {
    if (!fs.existsSync(BATCH_TEMP_DIR)) {
      fs.mkdirSync(BATCH_TEMP_DIR, { recursive: true });
    }
  }

  isAvailable(): boolean {
    return this.openaiClient !== null;
  }

  async queueTask(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      priority?: 'low' | 'normal';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI Batch API not available');
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const customId = `ecode_${taskId}`;

    const task: BatchTask = {
      id: taskId,
      customId,
      model,
      messages,
      priority: options?.priority || 'normal',
      status: 'pending',
      createdAt: Date.now(),
    };

    this.pendingTasks.set(taskId, task);
    this.metrics.pendingTasks = this.pendingTasks.size;

    logger.info('Batch task queued', { taskId, model, priority: task.priority });

    this.scheduleBatchSubmission();

    return taskId;
  }

  async queueTaskWithCallback(
    model: string,
    messages: Array<{ role: string; content: string }>,
    callback: (result: string | null, error?: string) => void,
    options?: {
      priority?: 'low' | 'normal';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    const taskId = await this.queueTask(model, messages, options);
    this.taskCallbacks.set(taskId, callback);
    return taskId;
  }

  private scheduleBatchSubmission(): void {
    if (this.batchTimer) {
      return;
    }

    if (this.pendingTasks.size >= BATCH_SIZE_THRESHOLD) {
      this.submitBatch();
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      if (this.pendingTasks.size > 0) {
        this.submitBatch();
      }
    }, BATCH_TIMEOUT_MS);
  }

  private async submitBatch(): Promise<void> {
    if (!this.openaiClient || this.pendingTasks.size === 0) {
      return;
    }

    const tasks = Array.from(this.pendingTasks.values());
    this.pendingTasks.clear();
    this.metrics.pendingTasks = 0;

    const batchId = `batch_${Date.now()}`;
    const batchJob: BatchJob = {
      id: batchId,
      tasks,
      status: 'pending',
      createdAt: Date.now(),
      totalCostSaved: 0,
    };

    this.batchJobs.set(batchId, batchJob);
    this.metrics.totalBatchJobs++;

    try {
      const jsonlContent = tasks.map(task => JSON.stringify({
        custom_id: task.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model: task.model,
          messages: task.messages,
          max_tokens: 4000,
        }
      })).join('\n');

      const inputFilePath = path.join(BATCH_TEMP_DIR, `${batchId}_input.jsonl`);
      fs.writeFileSync(inputFilePath, jsonlContent);

      // Use Node.js fs.createReadStream for OpenAI file upload (not browser File API)
      const file = await this.openaiClient.files.create({
        file: fs.createReadStream(inputFilePath),
        purpose: 'batch',
      });

      const batch = await this.openaiClient.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: {
          batch_id: batchId,
          task_count: tasks.length.toString(),
        },
      });

      batchJob.openAiBatchId = batch.id;
      batchJob.status = 'submitted';
      batchJob.submittedAt = Date.now();

      tasks.forEach(task => {
        task.status = 'submitted';
      });

      logger.info('Batch submitted to OpenAI', { 
        batchId, 
        openAiBatchId: batch.id, 
        taskCount: tasks.length 
      });

      this.pollBatchStatus(batchId);

    } catch (error: any) {
      logger.error('Failed to submit batch', { batchId, error: error.message });
      batchJob.status = 'failed';
      this.metrics.failedBatchJobs++;

      tasks.forEach(task => {
        task.status = 'failed';
        task.error = error.message;
        const callback = this.taskCallbacks.get(task.id);
        if (callback) {
          callback(null, error.message);
          this.taskCallbacks.delete(task.id);
        }
      });
    }
  }

  private async pollBatchStatus(batchId: string): Promise<void> {
    const batchJob = this.batchJobs.get(batchId);
    if (!batchJob || !batchJob.openAiBatchId || !this.openaiClient) {
      return;
    }

    const poll = async () => {
      try {
        const batch = await this.openaiClient!.batches.retrieve(batchJob.openAiBatchId!);

        if (batch.status === 'completed') {
          await this.processBatchResults(batchId, batch.output_file_id!);
        } else if (batch.status === 'failed' || batch.status === 'expired' || batch.status === 'cancelled') {
          batchJob.status = batch.status as any;
          this.metrics.failedBatchJobs++;
          
          batchJob.tasks.forEach(task => {
            task.status = 'failed';
            task.error = `Batch ${batch.status}`;
            const callback = this.taskCallbacks.get(task.id);
            if (callback) {
              callback(null, task.error);
              this.taskCallbacks.delete(task.id);
            }
          });
        } else {
          batchJob.status = 'in_progress';
          setTimeout(poll, 30000);
        }
      } catch (error: any) {
        logger.error('Error polling batch status', { batchId, error: error.message });
        setTimeout(poll, 60000);
      }
    };

    setTimeout(poll, 10000);
  }

  private async processBatchResults(batchId: string, outputFileId: string): Promise<void> {
    const batchJob = this.batchJobs.get(batchId);
    if (!batchJob || !this.openaiClient) {
      return;
    }

    try {
      const fileResponse = await this.openaiClient.files.content(outputFileId);
      const content = await fileResponse.text();
      const results = content.trim().split('\n').map(line => JSON.parse(line));

      const taskMap = new Map(batchJob.tasks.map(t => [t.customId, t]));

      for (const result of results) {
        const task = taskMap.get(result.custom_id);
        if (!task) continue;

        if (result.response?.status_code === 200) {
          const responseContent = result.response.body?.choices?.[0]?.message?.content || '';
          task.status = 'completed';
          task.result = responseContent;
          task.completedAt = Date.now();

          const tokensUsed = result.response.body?.usage?.total_tokens || 0;
          const regularCost = tokensUsed * 0.00001;
          const batchCost = regularCost * 0.5;
          task.costSaved = regularCost - batchCost;
          batchJob.totalCostSaved += task.costSaved;

          const callback = this.taskCallbacks.get(task.id);
          if (callback) {
            callback(responseContent);
            this.taskCallbacks.delete(task.id);
          }
        } else {
          task.status = 'failed';
          task.error = result.error?.message || 'Unknown error';
          
          const callback = this.taskCallbacks.get(task.id);
          if (callback) {
            callback(null, task.error);
            this.taskCallbacks.delete(task.id);
          }
        }

        this.metrics.totalTasksProcessed++;
      }

      batchJob.status = 'completed';
      batchJob.completedAt = Date.now();
      this.metrics.completedBatchJobs++;
      this.metrics.totalCostSaved += batchJob.totalCostSaved;

      const completionTime = batchJob.completedAt - batchJob.createdAt;
      this.metrics.averageCompletionTime = 
        (this.metrics.averageCompletionTime * (this.metrics.completedBatchJobs - 1) + completionTime) / 
        this.metrics.completedBatchJobs;

      logger.info('Batch completed', { 
        batchId, 
        tasksProcessed: results.length,
        costSaved: batchJob.totalCostSaved.toFixed(4)
      });

    } catch (error: any) {
      logger.error('Error processing batch results', { batchId, error: error.message });
      batchJob.status = 'failed';
      this.metrics.failedBatchJobs++;
    }
  }

  async getTaskStatus(taskId: string): Promise<BatchTask | null> {
    for (const task of this.pendingTasks.values()) {
      if (task.id === taskId) return task;
    }

    for (const batch of this.batchJobs.values()) {
      const task = batch.tasks.find(t => t.id === taskId);
      if (task) return task;
    }

    return null;
  }

  getBatchStatus(batchId: string): BatchJob | null {
    return this.batchJobs.get(batchId) || null;
  }

  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  getAllBatches(): BatchJob[] {
    return Array.from(this.batchJobs.values());
  }

  getPendingTasks(): BatchTask[] {
    return Array.from(this.pendingTasks.values());
  }
}

export const batchAPIManager = new BatchAPIManager();
