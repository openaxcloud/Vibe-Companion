/**
 * Deployment Mode Configuration
 * 
 * Controls whether Kubernetes modules are enabled or disabled.
 * Designed for single-VM deployments that don't require K8s orchestration.
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('deployment-mode');

export type DeploymentMode = 'single-vm' | 'kubernetes' | 'hybrid';

const DEPLOYMENT_MODE = (process.env.DEPLOYMENT_MODE || 'single-vm') as DeploymentMode;
const KUBERNETES_ENABLED = process.env.KUBERNETES_ENABLED === 'true';

/**
 * Check if Kubernetes orchestration is enabled
 * Returns true only if KUBERNETES_ENABLED=true
 */
export function isKubernetesEnabled(): boolean {
  return KUBERNETES_ENABLED;
}

/**
 * Check if running in single-VM mode (default)
 * Returns true when DEPLOYMENT_MODE is 'single-vm' or not set
 */
export function isSingleVMMode(): boolean {
  return DEPLOYMENT_MODE === 'single-vm';
}

/**
 * Check if running in hybrid mode (some K8s features enabled)
 */
export function isHybridMode(): boolean {
  return DEPLOYMENT_MODE === 'hybrid';
}

/**
 * Get the current deployment mode
 */
export function getDeploymentMode(): DeploymentMode {
  return DEPLOYMENT_MODE;
}

/**
 * Get deployment configuration summary
 */
export function getDeploymentConfig() {
  return {
    mode: DEPLOYMENT_MODE,
    kubernetesEnabled: KUBERNETES_ENABLED,
    isSingleVM: isSingleVMMode(),
    isHybrid: isHybridMode(),
  };
}

logger.info(`Deployment mode: ${DEPLOYMENT_MODE}, Kubernetes enabled: ${KUBERNETES_ENABLED}`);
