// @ts-nocheck
/**
 * Blue-Green Deployment Service
 * Provides zero-downtime deployments with instant rollback capabilities
 */

import { db } from '../db';
// import { deploymentEnvironments, deploymentStrategies, projects, deployments } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ContainerOrchestrator } from '../orchestration/container-orchestrator';
import { CDNService } from '../edge/cdn-service';

interface BlueGreenConfig {
  projectId: number;
  strategy: 'blue-green' | 'canary' | 'rolling';
  autoPromote?: boolean;
  promotionDelay?: number; // minutes
  rollbackOnFailure?: boolean;
  healthCheckConfig?: {
    url: string;
    interval?: number;
    successThreshold?: number;
    failureThreshold?: number;
  };
}

interface DeploymentStatus {
  blue: EnvironmentStatus;
  green: EnvironmentStatus;
  activeEnvironment: 'blue' | 'green';
  trafficDistribution: {
    blue: number;
    green: number;
  };
}

interface EnvironmentStatus {
  version: string;
  status: 'active' | 'inactive' | 'deploying' | 'failed';
  health: 'healthy' | 'unhealthy' | 'unknown';
  url: string;
  containers: string[];
  lastHealthCheck?: Date;
}

export class BlueGreenDeploymentService {
  private orchestrator: ContainerOrchestrator;
  private cdnService: CDNService;
  private healthCheckIntervals: Map<number, NodeJS.Timeout> = new Map();

  constructor() {
    this.orchestrator = new ContainerOrchestrator();
    this.cdnService = new CDNService();
  }

  async initializeBlueGreen(
    projectId: number,
    config: BlueGreenConfig
  ): Promise<void> {
    // Create deployment strategy
    await db.insert(deploymentStrategies).values({
      projectId,
      strategyType: config.strategy,
      autoPromote: config.autoPromote || false,
      promotionDelay: config.promotionDelay,
      rollbackOnFailure: config.rollbackOnFailure ?? true,
      healthCheckInterval: config.healthCheckConfig?.interval || 30,
      successThreshold: config.healthCheckConfig?.successThreshold || 3,
      failureThreshold: config.healthCheckConfig?.failureThreshold || 3,
    });

    // Initialize blue environment (current production)
    await this.createEnvironment(projectId, 'blue', 'v1.0.0');
  }

  async deployNewVersion(
    projectId: number,
    version: string,
    buildId: string
  ): Promise<any> {
    // Get current deployment status
    const status = await this.getDeploymentStatus(projectId);
    
    // Determine target environment (opposite of active)
    const targetEnv = status.activeEnvironment === 'blue' ? 'green' : 'blue';
    
    // Update environment to deploying state
    await this.updateEnvironmentStatus(projectId, targetEnv, 'deploying');

    try {
      // Deploy containers to target environment
      const containers = await this.deployContainers(
        projectId,
        targetEnv,
        buildId
      );

      // Update environment with new version
      await db.update(deploymentEnvironments)
        .set({
          version,
          status: 'inactive',
          containerIds: containers.map(c => c.id),
          deploymentUrl: `https://${targetEnv}.${projectId}.e-code.ai`,
        })
        .where(and(
          eq(deploymentEnvironments.projectId, projectId),
          eq(deploymentEnvironments.environmentName, targetEnv)
        ));

      // Start health checks
      await this.startHealthChecks(projectId, targetEnv);

      // Get strategy for auto-promotion
      const [strategy] = await db.select()
        .from(deploymentStrategies)
        .where(eq(deploymentStrategies.projectId, projectId));

      if (strategy.autoPromote) {
        // Schedule auto-promotion
        setTimeout(() => {
          this.promoteEnvironment(projectId, targetEnv).catch(console.error);
        }, (strategy.promotionDelay || 5) * 60 * 1000);
      }

      return {
        environment: targetEnv,
        version,
        status: 'deployed',
        url: `https://${targetEnv}.${projectId}.e-code.ai`,
        containers: containers.length,
      };
    } catch (error) {
      await this.updateEnvironmentStatus(projectId, targetEnv, 'failed');
      throw error;
    }
  }

  async promoteEnvironment(
    projectId: number,
    environment: 'blue' | 'green'
  ): Promise<void> {
    // Check health before promoting
    const isHealthy = await this.checkEnvironmentHealth(projectId, environment);
    if (!isHealthy) {
      throw new Error('Cannot promote unhealthy environment');
    }

    // Get current environments
    const environments = await db.select()
      .from(deploymentEnvironments)
      .where(eq(deploymentEnvironments.projectId, projectId));

    const blueEnv = environments.find(e => e.environmentName === 'blue');
    const greenEnv = environments.find(e => e.environmentName === 'green');

    if (!blueEnv || !greenEnv) {
      throw new Error('Both environments must exist');
    }

    // Update traffic distribution
    if (environment === 'blue') {
      await this.updateTrafficDistribution(projectId, 100, 0);
      await db.update(deploymentEnvironments)
        .set({ status: 'active', trafficPercentage: 100, activatedAt: new Date() })
        .where(eq(deploymentEnvironments.id, blueEnv.id));
      await db.update(deploymentEnvironments)
        .set({ status: 'inactive', trafficPercentage: 0 })
        .where(eq(deploymentEnvironments.id, greenEnv.id));
    } else {
      await this.updateTrafficDistribution(projectId, 0, 100);
      await db.update(deploymentEnvironments)
        .set({ status: 'inactive', trafficPercentage: 0 })
        .where(eq(deploymentEnvironments.id, blueEnv.id));
      await db.update(deploymentEnvironments)
        .set({ status: 'active', trafficPercentage: 100, activatedAt: new Date() })
        .where(eq(deploymentEnvironments.id, greenEnv.id));
    }

    // Update CDN routing
    await this.cdnService.updateOrigin(
      projectId.toString(),
      environment === 'blue' ? blueEnv.deploymentUrl! : greenEnv.deploymentUrl!
    );
  }

  async rollback(projectId: number): Promise<void> {
    const status = await this.getDeploymentStatus(projectId);
    
    // Switch to the opposite environment
    const targetEnv = status.activeEnvironment === 'blue' ? 'green' : 'blue';
    
    await this.promoteEnvironment(projectId, targetEnv);
  }

  async canaryDeploy(
    projectId: number,
    version: string,
    buildId: string,
    initialTrafficPercentage: number = 10
  ): Promise<any> {
    // Deploy new version to green environment
    const deployment = await this.deployNewVersion(projectId, version, buildId);
    
    // Start with small traffic percentage
    await this.updateTrafficDistribution(
      projectId,
      100 - initialTrafficPercentage,
      initialTrafficPercentage
    );

    // Monitor and gradually increase traffic
    const intervalId = setInterval(async () => {
      try {
        const isHealthy = await this.checkEnvironmentHealth(projectId, 'green');
        if (!isHealthy) {
          // Rollback if unhealthy
          await this.rollback(projectId);
          clearInterval(intervalId);
          return;
        }

        // Increase traffic by 10%
        const status = await this.getDeploymentStatus(projectId);
        const newGreenTraffic = Math.min(
          status.trafficDistribution.green + 10,
          100
        );
        
        await this.updateTrafficDistribution(
          projectId,
          100 - newGreenTraffic,
          newGreenTraffic
        );

        if (newGreenTraffic === 100) {
          // Fully promoted
          await this.promoteEnvironment(projectId, 'green');
          clearInterval(intervalId);
        }
      } catch (error) {
        console.error('Canary deployment error:', error);
        await this.rollback(projectId);
        clearInterval(intervalId);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return deployment;
  }

  private async deployContainers(
    projectId: number,
    environment: string,
    buildId: string
  ): Promise<any[]> {
    // Deploy containers for the environment
    const containers = [];
    
    // Deploy multiple containers for high availability
    for (let i = 0; i < 3; i++) {
      const container = await this.orchestrator.createContainer({
        name: `${projectId}-${environment}-${i}`,
        image: `builds/${buildId}`,
        env: {
          NODE_ENV: 'production',
          ENVIRONMENT: environment,
          PROJECT_ID: projectId.toString(),
        },
        labels: {
          environment,
          projectId: projectId.toString(),
          version: buildId,
        },
      });
      
      containers.push(container);
    }

    return containers;
  }

  private async createEnvironment(
    projectId: number,
    environmentName: 'blue' | 'green',
    version: string
  ): Promise<void> {
    const status = environmentName === 'blue' ? 'active' : 'inactive';
    const trafficPercentage = environmentName === 'blue' ? 100 : 0;

    await db.insert(deploymentEnvironments).values({
      projectId,
      environmentName,
      version,
      status,
      trafficPercentage,
      healthCheckUrl: `https://${environmentName}.${projectId}.e-code.ai/health`,
      deploymentUrl: `https://${environmentName}.${projectId}.e-code.ai`,
      containerIds: [],
    });
  }

  private async updateEnvironmentStatus(
    projectId: number,
    environment: string,
    status: string
  ): Promise<void> {
    await db.update(deploymentEnvironments)
      .set({ status })
      .where(and(
        eq(deploymentEnvironments.projectId, projectId),
        eq(deploymentEnvironments.environmentName, environment)
      ));
  }

  private async startHealthChecks(
    projectId: number,
    environment: string
  ): Promise<void> {
    const [strategy] = await db.select()
      .from(deploymentStrategies)
      .where(eq(deploymentStrategies.projectId, projectId));

    const [env] = await db.select()
      .from(deploymentEnvironments)
      .where(and(
        eq(deploymentEnvironments.projectId, projectId),
        eq(deploymentEnvironments.environmentName, environment)
      ));

    if (!env.healthCheckUrl) return;

    const checkHealth = async () => {
      try {
        const response = await fetch(env.healthCheckUrl!);
        const isHealthy = response.ok;
        
        // Update health status in memory
        // In production, store in database or cache
        
        if (!isHealthy && strategy.rollbackOnFailure) {
          // Trigger rollback
          await this.rollback(projectId);
        }
      } catch (error) {
        console.error(`Health check failed for ${environment}:`, error);
      }
    };

    // Start periodic health checks
    const intervalId = setInterval(
      checkHealth,
      (strategy.healthCheckInterval || 30) * 1000
    );
    
    this.healthCheckIntervals.set(projectId, intervalId);
  }

  private async checkEnvironmentHealth(
    projectId: number,
    environment: string
  ): Promise<boolean> {
    const [env] = await db.select()
      .from(deploymentEnvironments)
      .where(and(
        eq(deploymentEnvironments.projectId, projectId),
        eq(deploymentEnvironments.environmentName, environment)
      ));

    if (!env.healthCheckUrl) return true;

    try {
      const response = await fetch(env.healthCheckUrl);
      return response.ok;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  private async updateTrafficDistribution(
    projectId: number,
    bluePercentage: number,
    greenPercentage: number
  ): Promise<void> {
    // Update database
    await db.update(deploymentEnvironments)
      .set({ trafficPercentage: bluePercentage })
      .where(and(
        eq(deploymentEnvironments.projectId, projectId),
        eq(deploymentEnvironments.environmentName, 'blue')
      ));

    await db.update(deploymentEnvironments)
      .set({ trafficPercentage: greenPercentage })
      .where(and(
        eq(deploymentEnvironments.projectId, projectId),
        eq(deploymentEnvironments.environmentName, 'green')
      ));

    // Update load balancer configuration
    // In production, update actual load balancer rules
  }

  async getDeploymentStatus(projectId: number): Promise<DeploymentStatus> {
    const environments = await db.select()
      .from(deploymentEnvironments)
      .where(eq(deploymentEnvironments.projectId, projectId));

    const blueEnv = environments.find(e => e.environmentName === 'blue');
    const greenEnv = environments.find(e => e.environmentName === 'green');

    if (!blueEnv || !greenEnv) {
      throw new Error('Environments not initialized');
    }

    const activeEnvironment = blueEnv.status === 'active' ? 'blue' : 'green';

    return {
      blue: {
        version: blueEnv.version,
        status: blueEnv.status as any,
        health: await this.checkEnvironmentHealth(projectId, 'blue') ? 'healthy' : 'unhealthy',
        url: blueEnv.deploymentUrl!,
        containers: blueEnv.containerIds as string[],
      },
      green: {
        version: greenEnv.version,
        status: greenEnv.status as any,
        health: await this.checkEnvironmentHealth(projectId, 'green') ? 'healthy' : 'unhealthy',
        url: greenEnv.deploymentUrl!,
        containers: greenEnv.containerIds as string[],
      },
      activeEnvironment,
      trafficDistribution: {
        blue: blueEnv.trafficPercentage,
        green: greenEnv.trafficPercentage,
      },
    };
  }

  async cleanup(projectId: number): void {
    // Stop health checks
    const intervalId = this.healthCheckIntervals.get(projectId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(projectId);
    }

    // Clean up containers
    const environments = await db.select()
      .from(deploymentEnvironments)
      .where(eq(deploymentEnvironments.projectId, projectId));

    for (const env of environments) {
      const containerIds = env.containerIds as string[];
      for (const containerId of containerIds) {
        await this.orchestrator.removeContainer(containerId);
      }
    }
  }
}