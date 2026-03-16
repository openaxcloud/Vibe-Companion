import { useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DEFAULT_SHORTCUTS,
  mergeWithDefaults,
  shortcutMatchesEvent,
  type KeyboardShortcutsMap,
} from "@shared/keyboardShortcuts";

export function useKeyboardShortcuts() {
  const queryClient = useQueryClient();

  const { data: userOverrides, isLoading } = useQuery<KeyboardShortcutsMap>({
    queryKey: ["/api/user/keyboard-shortcuts"],
    staleTime: 60000,
    retry: false,
  });

  const resolvedMap: KeyboardShortcutsMap = useMemo(
    () => mergeWithDefaults(userOverrides || {}),
    [userOverrides]
  );

  const resolvedMapRef = useRef(resolvedMap);
  resolvedMapRef.current = resolvedMap;

  const saveMutation = useMutation({
    mutationFn: async (shortcuts: KeyboardShortcutsMap) => {
      const res = await apiRequest("PUT", "/api/user/keyboard-shortcuts", shortcuts);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/keyboard-shortcuts"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/keyboard-shortcuts"] });
    },
  });

  const updateShortcut = useCallback((commandId: string, keys: string | null) => {
    const current = queryClient.getQueryData<KeyboardShortcutsMap>(["/api/user/keyboard-shortcuts"]) || {};
    const defaultDef = DEFAULT_SHORTCUTS.find(s => s.id === commandId);
    const isDefault = defaultDef && keys === defaultDef.defaultKeys;

    let newOverrides: KeyboardShortcutsMap;
    if (isDefault) {
      newOverrides = { ...current };
      delete newOverrides[commandId];
    } else {
      newOverrides = { ...current, [commandId]: keys };
    }

    queryClient.setQueryData(["/api/user/keyboard-shortcuts"], newOverrides);
    saveMutation.mutate(newOverrides);
  }, [saveMutation, queryClient]);

  const resetShortcut = useCallback((commandId: string) => {
    const current = queryClient.getQueryData<KeyboardShortcutsMap>(["/api/user/keyboard-shortcuts"]) || {};
    const newOverrides = { ...current };
    delete newOverrides[commandId];
    queryClient.setQueryData(["/api/user/keyboard-shortcuts"], newOverrides);
    saveMutation.mutate(newOverrides);
  }, [saveMutation, queryClient]);

  const resetAll = useCallback(() => {
    queryClient.setQueryData(["/api/user/keyboard-shortcuts"], {});
    saveMutation.mutate({});
  }, [saveMutation, queryClient]);

  const removeShortcut = useCallback((commandId: string) => {
    const current = queryClient.getQueryData<KeyboardShortcutsMap>(["/api/user/keyboard-shortcuts"]) || {};
    const newOverrides = { ...current, [commandId]: null };
    queryClient.setQueryData(["/api/user/keyboard-shortcuts"], newOverrides);
    saveMutation.mutate(newOverrides);
  }, [saveMutation, queryClient]);

  const forceAssignShortcut = useCallback((commandId: string, keys: string, conflictCommandId: string) => {
    const current = queryClient.getQueryData<KeyboardShortcutsMap>(["/api/user/keyboard-shortcuts"]) || {};
    const newOverrides = { ...current, [commandId]: keys, [conflictCommandId]: null };

    const defaultDef = DEFAULT_SHORTCUTS.find(s => s.id === commandId);
    if (defaultDef && keys === defaultDef.defaultKeys) {
      delete newOverrides[commandId];
    }

    queryClient.setQueryData(["/api/user/keyboard-shortcuts"], newOverrides);
    saveMutation.mutate(newOverrides);
  }, [saveMutation, queryClient]);

  const matchesCommand = useCallback((commandId: string, e: KeyboardEvent): boolean => {
    return shortcutMatchesEvent(resolvedMapRef.current[commandId], e);
  }, []);

  const getShortcutDisplay = useCallback((commandId: string): string | null => {
    return resolvedMapRef.current[commandId] ?? null;
  }, []);

  return {
    shortcuts: resolvedMap,
    userOverrides: userOverrides || {},
    isLoading,
    updateShortcut,
    resetShortcut,
    resetAll,
    removeShortcut,
    forceAssignShortcut,
    matchesCommand,
    getShortcutDisplay,
    isSaving: saveMutation.isPending,
  };
}
