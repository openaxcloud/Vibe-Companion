// @ts-nocheck
/**
 * Service Integration Module
 * Integrates all real services into the application
 */

import { createLogger } from '../utils/logger';
import { realTerminalService } from '../terminal/real-terminal';
import { dockerExecutor } from '../execution/docker-executor';
import { realCodeGenerator } from '../ai/real-code-generator';
import { realWebSearchService } from './real-web-search';
import { realPackageManager } from './real-package-manager';
import { realCollaborationService } from '../collaboration/real-collaboration';
import { realEmailService } from './real-email-service';
import { real2FAService } from './real-2fa-service';
import { storageService } from './storage.service';
import { realMobileCompiler } from './real-mobile-compiler';

const logger = createLogger('service-integration');

export interface IntegratedServices {
  terminal: typeof realTerminalService;
  docker: typeof dockerExecutor;
  codeGenerator: typeof realCodeGenerator;
  webSearch: typeof realWebSearchService;
  packageManager: typeof realPackageManager;
  collaboration: typeof realCollaborationService;
  email: typeof realEmailService;
  twoFactor: typeof real2FAService;
  objectStorage: typeof storageService;
  mobileCompiler: typeof realMobileCompiler;
}

export async function initializeRealServices(): Promise<IntegratedServices> {
  logger.info('Initializing real backend services...');

  try {
    // Initialize Docker executor
    await dockerExecutor.initialize();
    logger.info('Docker executor initialized');

    // Initialize other services that need initialization
    // Most services initialize themselves in their constructors

    const services: IntegratedServices = {
      terminal: realTerminalService,
      docker: dockerExecutor,
      codeGenerator: realCodeGenerator,
      webSearch: realWebSearchService,
      packageManager: realPackageManager,
      collaboration: realCollaborationService,
      email: realEmailService,
      twoFactor: real2FAService,
      objectStorage: storageService,
      mobileCompiler: realMobileCompiler
    };

    logger.info('All real backend services initialized successfully');
    return services;

  } catch (error) {
    logger.error(`Failed to initialize services: ${error}`);
    throw error;
  }
}

// Export individual services for backwards compatibility
export {
  realTerminalService,
  dockerExecutor,
  realCodeGenerator,
  realWebSearchService,
  realPackageManager,
  realCollaborationService,
  realEmailService,
  real2FAService,
  storageService,
  realMobileCompiler
};