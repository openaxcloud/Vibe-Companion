/**
 * GPU Service
 * DEPRECATED: GPU providers have been completely removed from the codebase.
 * AI compute is now handled directly through integrated AI providers.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('gpu-service');

export const gpuService = {
  available: false,
  deprecated: true,
  message: 'GPU compute is now handled via AI providers directly',
  
  async getStatus() {
    return { available: false, deprecated: true };
  },
  
  async allocate() {
    logger.warn('GPU providers deprecated - use AI providers directly');
    return { success: false, message: 'GPU providers deprecated' };
  },
  
  async deallocate() {
    return { success: false, message: 'GPU providers deprecated' };
  },
  
  async execute() {
    return { success: false, message: 'GPU providers deprecated' };
  },
  
  async listResources() {
    return [];
  }
};

export class GpuService {
  available = false;
  deprecated = true;
  message = 'GPU compute is now handled via AI providers directly';
  
  async getStatus() {
    return { available: false, deprecated: true };
  }
  
  async allocate() {
    logger.warn('GPU providers deprecated - use AI providers directly');
    return { success: false, message: 'GPU providers deprecated' };
  }
  
  async deallocate() {
    return { success: false, message: 'GPU providers deprecated' };
  }
  
  async execute() {
    return { success: false, message: 'GPU providers deprecated' };
  }
  
  async listResources() {
    return [];
  }
}

export function getGpuService() {
  logger.warn('GPU providers deprecated - use AI providers directly');
  return gpuService;
}
