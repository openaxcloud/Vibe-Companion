/**
 * Web API Client Adapter for Agent Session
 * Configures the shared Agent hook to use web's apiRequest
 */

import { configureAgentApi, type ApiClient } from '@/../../shared/agent';
import { apiRequest } from './queryClient';

const webApiClient: ApiClient = {
  post: async (url: string, data: any) => {
    // apiRequest already returns parsed JSON, not a Response object
    return await apiRequest('POST', url, data);
  }
};

// Configure the shared Agent API client for web
configureAgentApi(webApiClient);

export { webApiClient };
