import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
// EnvironmentVariable type definition
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type EnvironmentVariable = {
  id: number;
  projectId: number;
  key: string;
  value: string;
  isSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EnvironmentVariableInput = {
  key: string;
  value: string;
  isSecret: boolean;
};

type EnvironmentContextType = {
  variables: EnvironmentVariable[];
  isLoading: boolean;
  error: Error | null;
  createVariableMutation: UseMutationResult<
    EnvironmentVariable,
    Error,
    { projectId: number; variable: EnvironmentVariableInput }
  >;
  updateVariableMutation: UseMutationResult<
    EnvironmentVariable,
    Error,
    { id: number; projectId: number; variable: Partial<EnvironmentVariableInput> }
  >;
  deleteVariableMutation: UseMutationResult<
    void,
    Error,
    { id: number; projectId: number }
  >;
};

export const EnvironmentContext = createContext<EnvironmentContextType | null>(null);

export function EnvironmentProvider({
  projectId,
  children,
}: {
  projectId: number;
  children: ReactNode;
}) {
  const { toast } = useToast();
  const {
    data: variables = [],
    error,
    isLoading,
  } = useQuery<EnvironmentVariable[], Error>({
    queryKey: [`/api/environment/${projectId}`],
    queryFn: async () => {
      // apiRequest already returns parsed JSON and throws on !ok
      return await apiRequest('GET', `/api/environment/${projectId}`);
    },
    enabled: !!projectId,
  });

  const createVariableMutation = useMutation({
    mutationFn: async ({ projectId, variable }: { projectId: number; variable: EnvironmentVariableInput }) => {
      // apiRequest already returns parsed JSON
      return await apiRequest(
        "POST",
        `/api/environment/${projectId}`,
        variable
      );
    },
    onSuccess: (newVariable: EnvironmentVariable) => {
      queryClient.invalidateQueries({ queryKey: [`/api/environment/${projectId}`] });
      toast({
        title: "Variable created",
        description: `Environment variable "${newVariable.key}" has been created.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateVariableMutation = useMutation({
    mutationFn: async ({
      id,
      projectId,
      variable,
    }: {
      id: number;
      projectId: number;
      variable: Partial<EnvironmentVariableInput>;
    }) => {
      // apiRequest already returns parsed JSON
      return await apiRequest(
        "PATCH",
        `/api/environment/${projectId}/${id}`,
        variable
      );
    },
    onSuccess: (updatedVariable: EnvironmentVariable) => {
      queryClient.invalidateQueries({ queryKey: [`/api/environment/${projectId}`] });
      toast({
        title: "Variable updated",
        description: `Environment variable "${updatedVariable.key}" has been updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteVariableMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) => {
      await apiRequest(
        "DELETE",
        `/api/environment/${projectId}/${id}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/environment/${projectId}`] });
      toast({
        title: "Variable deleted",
        description: "Environment variable has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete variable",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <EnvironmentContext.Provider
      value={{
        variables,
        isLoading,
        error,
        createVariableMutation,
        updateVariableMutation,
        deleteVariableMutation,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
}