import { QueryClient, QueryClientConfig, DefaultOptions } from "@tanstack/react-query";

export const defaultStaleTime = 1000 * 30; // 30 seconds
export const defaultCacheTime = 1000 * 60 * 5; // 5 minutes

const defaultQueryOptions: DefaultOptions["queries"] = {
  staleTime: defaultStaleTime,
  cacheTime: defaultCacheTime,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: false,
  retry: 2,
};

const defaultMutationOptions: DefaultOptions["mutations"] = {
  retry: 1,
};

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: defaultQueryOptions,
    mutations: defaultMutationOptions,
  },
};

export const queryClient = new QueryClient(queryClientConfig);

type QueryKey = readonly unknown[];

type InvalidateOptions = {
  exact?: boolean;
  refetchType?: "active" | "all" | "inactive" | "none";
};

type PrefetchOptions<TQueryFnData = unknown> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TQueryFnData>;
  staleTime?: number;
};

export function invalidateQuery(
  queryKey: QueryKey,
  options?: InvalidateOptions
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey, ...options });
}

export function invalidateQueries(
  queryKeys: QueryKey[],
  options?: InvalidateOptions
): Promise<void[]> {
  return Promise.all(
    queryKeys.map((key) => queryClient.invalidateQueries({ queryKey: key, ...options }))
  );
}

export function prefetchQuery<TQueryFnData = unknown>(
  options: PrefetchOptions<TQueryFnData>
): Promise<void> {
  const { queryKey, queryFn, staleTime } = options;
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}

export function getQueryData<TData = unknown>(queryKey: QueryKey): TData | undefined {
  return queryClient.getQueryData<TData>(queryKey);
}

export function setQueryData<TData = unknown>(
  queryKey: QueryKey,
  updater: TData | ((oldData: TData | undefined) => TData)
): TData | undefined {
  return queryClient.setQueryData<TData>(queryKey, updater);
}

export function updateQueryData<TData = unknown>(
  queryKey: QueryKey,
  updater: (oldData: TData | undefined) => TData
): TData | undefined {
  return queryClient.setQueryData<TData>(queryKey, updater);
}

export function clearQuery(queryKey: QueryKey): void {
  queryClient.removeQueries({ queryKey });
}

export function clearAllQueries(): void {
  queryClient.clear();
}