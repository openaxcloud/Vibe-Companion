// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TenantState {
  currentTenantId: number | null;
  tenantName: string | null;
  tenantRole: string | null;
  setCurrentTenant: (tenantId: number | null, name?: string, role?: string) => void;
  clearTenant: () => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      currentTenantId: null,
      tenantName: null,
      tenantRole: null,
      setCurrentTenant: (tenantId, name, role) => set({
        currentTenantId: tenantId,
        tenantName: name ?? null,
        tenantRole: role ?? null
      }),
      clearTenant: () => set({
        currentTenantId: null,
        tenantName: null,
        tenantRole: null
      })
    }),
    {
      name: 'e-code-tenant-context'
    }
  )
);

export function useTenantContext() {
  const { currentTenantId, tenantName, tenantRole, setCurrentTenant, clearTenant } = useTenantStore();

  return {
    tenantId: currentTenantId,
    tenantName,
    tenantRole,
    setTenant: setCurrentTenant,
    clearTenant,
    hasTenant: currentTenantId !== null
  };
}

export function getTenantHeaders(): Record<string, string> {
  const { currentTenantId } = useTenantStore.getState();
  
  if (currentTenantId !== null) {
    return { 'X-Tenant-Id': String(currentTenantId) };
  }
  
  return {};
}

export function createTenantQueryKey(
  baseKey: string | readonly unknown[],
  tenantId?: number | null
): readonly unknown[] {
  const { currentTenantId } = useTenantStore.getState();
  const effectiveTenantId = tenantId ?? currentTenantId;
  
  const keyArray = typeof baseKey === 'string' ? [baseKey] : [...baseKey];
  
  if (effectiveTenantId !== null) {
    return ['tenant', effectiveTenantId, ...keyArray] as const;
  }
  
  return keyArray as const;
}

export function useTenantQuery<T>(
  baseKey: string | readonly unknown[],
  options: {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  } = {}
) {
  const { currentTenantId } = useTenantStore();
  
  const queryKey = createTenantQueryKey(baseKey, currentTenantId);
  
  return useQuery<T>({
    queryKey,
    ...options
  });
}

export function useUserTeams() {
  return useQuery<Array<{
    id: number;
    name: string;
    slug: string;
    role: string;
    isOwner: boolean;
  }>>({
    queryKey: ['/api/user/teams']
  });
}

export function useSwitchTenant() {
  const queryClient = useQueryClient();
  const { setCurrentTenant, clearTenant } = useTenantStore();

  return useMutation({
    mutationFn: async (tenantId: number | null) => {
      if (tenantId === null) {
        return { tenantId: null, name: null, role: null };
      }

      const response = await apiRequest('GET', `/api/teams/${tenantId}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.tenantId === null) {
        clearTenant();
      } else {
        setCurrentTenant(data.id, data.name, data.role);
      }

      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key[0] === 'tenant';
        }
      });
    }
  });
}

export function invalidateTenantQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId?: number | null
) {
  const { currentTenantId } = useTenantStore.getState();
  const effectiveTenantId = tenantId ?? currentTenantId;

  if (effectiveTenantId !== null) {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        return (
          Array.isArray(key) &&
          key[0] === 'tenant' &&
          key[1] === effectiveTenantId
        );
      }
    });
  }
}

export function useTenantAwareApiRequest() {
  const { currentTenantId } = useTenantStore();

  return async (
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: unknown
  ) => {
    const headers: Record<string, string> = {};
    
    if (currentTenantId !== null) {
      headers['X-Tenant-Id'] = String(currentTenantId);
    }

    return apiRequest(method, url, data);
  };
}
