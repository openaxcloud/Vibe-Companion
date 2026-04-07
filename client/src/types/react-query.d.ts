import type {
  QueryKey,
  QueryClient,
  DefinedUseQueryResult,
  UseQueryResult,
  UseQueryOptions,
  DefinedInitialDataOptions,
  UndefinedInitialDataOptions,
  UseMutationOptions,
  UseMutationResult,
  MutationFunction
} from '@tanstack/react-query';

declare module '@tanstack/react-query' {
  function useQuery<TQueryFnData = any, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
    options: DefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
    queryClient?: QueryClient
  ): DefinedUseQueryResult<TData, TError>;
  function useQuery<TQueryFnData = any, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
    options: UndefinedInitialDataOptions<TQueryFnData, TError, TData, TQueryKey>,
    queryClient?: QueryClient
  ): UseQueryResult<TData, TError>;
  function useQuery<TQueryFnData = any, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
    options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    queryClient?: QueryClient
  ): UseQueryResult<TData, TError>;

  function useMutation<TData = any, TError = Error, TVariables = any, TContext = unknown>(
    options: UseMutationOptions<TData, TError, TVariables, TContext>
  ): UseMutationResult<TData, TError, TVariables, TContext>;
  function useMutation<TData = any, TError = Error, TVariables = any, TContext = unknown>(
    mutationFn: MutationFunction<TData, TVariables>,
    options?: UseMutationOptions<TData, TError, TVariables, TContext>
  ): UseMutationResult<TData, TError, TVariables, TContext>;
}
