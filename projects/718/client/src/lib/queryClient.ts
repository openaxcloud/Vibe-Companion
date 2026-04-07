import { QueryClient, QueryCache, MutationCache, DefaultOptions } from "@tanstack/react-query";

const defaultQueryOptions: DefaultOptions["queries"] = {
  staleTime: 1000 * 60 * 5, // 5 minutes
  cacheTime: 1000 * 60 * 30, // 30 minutes
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchOnMount: false,
  retry: (failureCount: number, error: unknown) => {
    if (failureCount >= 3) return false;
    if (typeof window === "undefined") return false;
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("unauthorized") || message.includes("forbidden")) {
        return false;
      }
    }
    return true;
  },
  retryDelay: (attemptIndex: number) => {
    const baseDelay = 1000;
    const maxDelay = 1000 * 30;
    const delay = Math.min(baseDelay * 2 ** attemptIndex, maxDelay);
    return delay + Math.random() * 300;
  },
};

const defaultMutationOptions: DefaultOptions["mutations"] = {
  retry: (failureCount: number, error: unknown) => {
    if (failureCount >= 2) return false;
    if (typeof window === "undefined") return false;
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("validation") || message.includes("bad request")) {
        return false;
      }
    }
    return true;
  },
  retryDelay: (attemptIndex: number) => {
    const baseDelay = 500;
    const maxDelay = 1000 * 15;
    const delay = Math.min(baseDelay * 2 ** attemptIndex, maxDelay);
    return delay + Math.random() * 200;
  },
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error(
          `[React Query] Query error in "undefined":`,
          error
        );
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error(
          `[React Query] Mutation error in "undefined":`,
          error
        );
      }
    },
  }),
  defaultOptions: {
    queries: defaultQueryOptions,
    mutations: defaultMutationOptions,
  },
});

export { queryClient };
export default queryClient;