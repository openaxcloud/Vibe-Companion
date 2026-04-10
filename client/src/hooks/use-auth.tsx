
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient, resetCSRFToken, fetchCsrfToken } from "../lib/queryClient";
// CRITICAL FIX: Import toast function directly instead of useToast hook
// useToast subscribes the component to ALL toast state changes, causing
// AuthProvider (which wraps the entire app) to re-render on every toast.
// This caused IDEPage and all children to remount when toggles triggered toasts.
import { toast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = {
  email: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  // NOTE: toast is now imported directly at module level (not from useToast hook)
  // This prevents AuthProvider from re-rendering on every toast in the app
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 2,
    retryDelay: 500,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      return await apiRequest<SelectUser>("POST", "/api/login", credentials);
    },
    onSuccess: async (user: SelectUser) => {
      resetCSRFToken();
      await fetchCsrfToken();
      queryClient.setQueryData(["/api/me"], user);
      await queryClient.invalidateQueries();
      const displayName = user.displayName || user.username || user.email?.split('@')[0] || 'User';
      toast({
        title: "Login successful",
        description: `Welcome back, ${displayName}!`,
      });
      // IMPORTANT: Do NOT navigate here with window.location.href
      // Let Login.tsx useEffect handle navigation to preserve sessionStorage flags
      // for the Replit-style BUILD → Login → Workspace flow
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      return await apiRequest<SelectUser>("POST", "/api/register", credentials);
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/me"], user);
      const displayName = user.displayName || user.username || user.email?.split('@')[0] || 'User';
      toast({
        title: "Registration successful",
        description: `Welcome, ${displayName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Only remove user-specific queries, keep public data like templates, docs, etc.
      queryClient.removeQueries({ queryKey: ['/api/me'] });
      queryClient.removeQueries({ queryKey: ['user'] });
      queryClient.removeQueries({ queryKey: ['profile'] });
      queryClient.removeQueries({ queryKey: ['/api/notifications'] });
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['settings'] });
      queryClient.removeQueries({ queryKey: ['billing'] });
      queryClient.removeQueries({ queryKey: ['/api/projects'] });
      // Make the logout API call
      await apiRequest<void>("POST", "/api/logout");
      return;
    },
    onSuccess: () => {
      // Ensure user data is cleared
      queryClient.setQueryData(["/api/me"], null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      // Navigate immediately - no race condition
      window.location.href = '/login';
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      // Still clear user-specific queries on error to ensure clean state
      queryClient.removeQueries({ queryKey: ['/api/me'] });
      queryClient.removeQueries({ queryKey: ['user'] });
      queryClient.removeQueries({ queryKey: ['profile'] });
      queryClient.removeQueries({ queryKey: ['/api/notifications'] });
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['settings'] });
      queryClient.removeQueries({ queryKey: ['billing'] });
      queryClient.removeQueries({ queryKey: ['/api/projects'] });
      queryClient.setQueryData(["/api/me"], null);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      // Navigate to login even on error for security
      window.location.href = '/login';
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isAuthenticated: !!user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
