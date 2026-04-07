import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: number;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
  isAdmin?: boolean;
  emailVerified?: boolean;
}

async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: fetchCurrentUser,
    staleTime: 60_000,
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.href = "/";
    },
  });

  const logout = () => logoutMutation.mutate();

  return {
    user: user ?? null,
    isAuthenticated: !!user,
    isLoading,
    logoutMutation,
    logout,
  };
}
