import { IDatabaseProvider, DatabaseProvider, ProvisioningOptions } from './database-provider.interface';
import { neonProvider } from './neon.provider';
import { cloudNativePGProvider } from './cloudnativepg.provider';
import { localProvider } from './local.provider';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DatabaseProviderFactory');

export * from './database-provider.interface';
export { neonProvider } from './neon.provider';
export { cloudNativePGProvider } from './cloudnativepg.provider';
export { localProvider } from './local.provider';

const providers: Record<DatabaseProvider, IDatabaseProvider> = {
  neon: neonProvider,
  cloudnativepg: cloudNativePGProvider,
  supabase: localProvider,
  local: localProvider
};

export function getProvider(providerName: DatabaseProvider = 'neon'): IDatabaseProvider {
  const provider = providers[providerName];
  if (!provider) {
    logger.warn(`Unknown provider ${providerName}, falling back to local`);
    return localProvider;
  }
  return provider;
}

export async function selectBestProvider(options: ProvisioningOptions): Promise<IDatabaseProvider> {
  if (options.provider) {
    return getProvider(options.provider);
  }
  
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'single-vm';
  
  if (deploymentMode === 'kubernetes') {
    const isK8sHealthy = await cloudNativePGProvider.isHealthy();
    if (isK8sHealthy) {
      logger.info('Selected CloudNativePG provider for Kubernetes deployment');
      return cloudNativePGProvider;
    }
    logger.warn('CloudNativePG not available, falling back to Neon');
  }
  
  const neonApiKey = process.env.NEON_API_KEY;
  if (neonApiKey) {
    const isNeonHealthy = await neonProvider.isHealthy();
    if (isNeonHealthy) {
      logger.info('Selected Neon provider');
      return neonProvider;
    }
    logger.warn('Neon not healthy, falling back to local');
  }
  
  logger.info('Selected local provider (default fallback)');
  return localProvider;
}

export async function getProviderHealth(): Promise<Record<DatabaseProvider, boolean>> {
  const [neonHealth, k8sHealth, localHealth] = await Promise.all([
    neonProvider.isHealthy().catch(() => false),
    cloudNativePGProvider.isHealthy().catch(() => false),
    localProvider.isHealthy().catch(() => false)
  ]);
  
  return {
    neon: neonHealth,
    cloudnativepg: k8sHealth,
    supabase: false,
    local: localHealth
  };
}
