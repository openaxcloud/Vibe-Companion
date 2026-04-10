/**
 * Real-time Agent WebSocket Hook
 * Subscribes to agent progress updates via WebSocket for live UI sync
 * Supports cross-platform synchronization across web, mobile, and desktop
 * Extended with unified activity event streaming for inline chat and Progress dock
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import type { 
  ActivityEvent, 
  ActivityStreamMessage,
  ThinkingStep,
  ToolExecutionEvent,
  FileChangeEvent,
  AgentSessionState
} from '@shared/types/agent-activity.types';

interface AgentProgressUpdate {
  type: 'step' | 'summary' | 'error' | 'complete' | 'progress' | 'device_connected' | 'device_disconnected' | 'connected' | 'activity';
  projectId: number;
  sessionId: string;
  data?: any;
  deviceId?: string;
  deviceType?: 'web' | 'mobile' | 'desktop';
  totalDevices?: number;
  roster?: ConnectedDevice[];
  connectedAt?: string;
  activity?: ActivityEvent;
}

interface ConnectedDevice {
  deviceId: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  connectedAt: string;
}

interface UseAgentWebSocketOptions {
  projectId: number;
  sessionId?: string;
  onUpdate?: (update: AgentProgressUpdate) => void;
  onActivity?: (activity: ActivityEvent) => void;
  enabled?: boolean;
}

// Detect device type based on user agent and screen size
function detectDeviceType(): 'web' | 'mobile' | 'desktop' {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet = isMobile && window.innerWidth >= 768;
  
  if (isMobile && !isTablet) return 'mobile';
  if (isTablet) return 'mobile'; // Tablets count as mobile for now
  return 'web';
}

// Generate stable device ID (persists across page reloads)
function getDeviceId(): string {
  const storageKey = 'agent-device-id';
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    deviceId = `${detectDeviceType()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}

// ============================================
// ENTERPRISE-GRADE RECONNECTION CONFIG
// Fortune 500 reliability for WebSocket connections
// ============================================
const RECONNECT_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 10,
  backoffMultiplier: 2,
  jitterFactor: 0.3, // Add randomness to prevent thundering herd
};

export function useAgentWebSocket({
  projectId,
  sessionId,
  onUpdate,
  onActivity,
  enabled = true
}: UseAgentWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<AgentProgressUpdate | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [currentDeviceId] = useState(getDeviceId());
  const [currentDeviceType] = useState(detectDeviceType());
  const [serverTotalDevices, setServerTotalDevices] = useState<number | null>(null);
  
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionEvent[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChangeEvent[]>([]);
  const [currentActivity, setCurrentActivity] = useState<ActivityEvent | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const activityHistoryRef = useRef<ActivityEvent[]>([]);
  
  // Reconnection state
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimestampRef = useRef<number>(Date.now());
  
  // Calculate reconnection delay with exponential backoff and jitter
  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const { initialDelayMs, maxDelayMs, backoffMultiplier, jitterFactor } = RECONNECT_CONFIG;
    const exponentialDelay = Math.min(
      initialDelayMs * Math.pow(backoffMultiplier, attempt),
      maxDelayMs
    );
    const jitter = exponentialDelay * jitterFactor * Math.random();
    return exponentialDelay + jitter;
  }, []);

  // Schedule a reconnection attempt
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempt >= RECONNECT_CONFIG.maxRetries) {
      setConnectionStatus('disconnected');
      setError(new Error(`Connection failed after ${RECONNECT_CONFIG.maxRetries} attempts`));
      return;
    }

    const delay = calculateReconnectDelay(reconnectAttempt);
    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempt(prev => prev + 1);
      connect();
    }, delay);
  }, [reconnectAttempt, calculateReconnectDelay]);

  // Request state reconciliation from server after reconnect
  const requestStateReconciliation = useCallback((ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'reconcile',
        lastEventTimestamp: lastEventTimestampRef.current,
        deviceId: currentDeviceId
      }));
    }
  }, [currentDeviceId]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId) {
      return null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    
    try {
      setConnectionStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws/agent?projectId=${projectId}&sessionId=${sessionId}&deviceId=${currentDeviceId}&deviceType=${currentDeviceType}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        setReconnectAttempt(0); // Reset retry counter on successful connection

        // Request state reconciliation if this was a reconnection
        if (reconnectAttempt > 0) {
          requestStateReconciliation(ws);
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const update: AgentProgressUpdate = JSON.parse(event.data);
          lastEventTimestampRef.current = Date.now(); // Track last event for reconciliation
          
          // Handle presence updates separately
          if (update.type === 'connected') {
            // Store server's authoritative total
            if (typeof update.totalDevices === 'number') {
              setServerTotalDevices(update.totalDevices);
            }
            
            // Hydrate roster from server, then ADD current device
            const roster = update.roster && Array.isArray(update.roster) ? update.roster : [];
            const currentDevice: ConnectedDevice = {
              deviceId: currentDeviceId,
              deviceType: currentDeviceType,
              connectedAt: new Date().toISOString()
            };
            
            setConnectedDevices([...roster, currentDevice]);
          } else if (update.type === 'device_connected') {
            // Update server's authoritative total
            if (typeof update.totalDevices === 'number') {
              setServerTotalDevices(update.totalDevices);
            }
            
            // Add new device to roster
            setConnectedDevices((prev) => {
              // Prevent duplicates
              if (prev.some((d) => d.deviceId === update.deviceId)) {
                return prev;
              }
              return [
                ...prev,
                {
                  deviceId: update.deviceId!,
                  deviceType: update.deviceType!,
                  connectedAt: update.connectedAt || new Date().toISOString()
                }
              ];
            });
          } else if (update.type === 'device_disconnected') {
            // Update server's authoritative total
            if (typeof update.totalDevices === 'number') {
              setServerTotalDevices(update.totalDevices);
            }
            
            setConnectedDevices((prev) => 
              prev.filter((d) => d.deviceId !== update.deviceId)
            );
          } else if (update.type === 'activity' && update.activity) {
            const activity = update.activity;
            
            // Store in activity history
            activityHistoryRef.current = [...activityHistoryRef.current, activity].slice(-100);
            setActivityEvents(activityHistoryRef.current);
            setCurrentActivity(activity);
            
            // Handle specific activity types
            switch (activity.type) {
              case 'thinking_start':
                setIsThinking(true);
                setThinkingSteps([]);
                break;
              case 'thinking_step':
                if ('stepNumber' in activity.payload && 'content' in activity.payload) {
                  setThinkingSteps(prev => [...prev, activity.payload as ThinkingStep]);
                }
                break;
              case 'thinking_end':
                setIsThinking(false);
                break;
              case 'tool_start':
              case 'tool_progress':
              case 'tool_complete':
              case 'tool_error':
                if ('toolName' in activity.payload && 'status' in activity.payload) {
                  const toolEvent = activity.payload as ToolExecutionEvent;
                  setToolExecutions(prev => {
                    const existing = prev.findIndex(t => t.id === toolEvent.id);
                    if (existing >= 0) {
                      const updated = [...prev];
                      updated[existing] = toolEvent;
                      return updated;
                    }
                    return [...prev, toolEvent];
                  });
                }
                break;
              case 'file_create':
              case 'file_edit':
              case 'file_delete':
                if ('filePath' in activity.payload && 'operation' in activity.payload) {
                  setFileChanges(prev => [...prev, activity.payload as FileChangeEvent]);
                }
                break;
            }
            
            onActivity?.(activity);
          }
          
          setLastUpdate(update);
          onUpdate?.(update);
        } catch (err) {
        }
      };
      
      ws.onerror = (event) => {
        setError(new Error('WebSocket connection error'));
        setIsConnected(false);
      };
      
      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;
        
        // Only attempt reconnect if not a clean close and still enabled
        if (enabled && event.code !== 1000) {
          scheduleReconnect();
        } else {
          setConnectionStatus('disconnected');
        }
      };
      
      return ws;
    } catch (err) {
      setError(err as Error);
      setConnectionStatus('disconnected');
      scheduleReconnect();
      return null;
    }
  }, [enabled, projectId, sessionId, currentDeviceId, currentDeviceType, onUpdate, onActivity, reconnectAttempt, scheduleReconnect, requestStateReconciliation]);
  
  // Initial connection and cleanup
  useEffect(() => {
    connect();
    
    return () => {
      // Clear reconnection timer
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Close WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  // Manual reconnect function for UI
  const manualReconnect = useCallback(() => {
    setReconnectAttempt(0);
    setError(null);
    connect();
  }, [connect]);
  
  // Prefer server's authoritative total, fall back to local count
  const totalDevices = serverTotalDevices ?? connectedDevices.length;
  
  // Clear activity state when session changes
  const clearActivityState = useCallback(() => {
    setActivityEvents([]);
    setThinkingSteps([]);
    setToolExecutions([]);
    setFileChanges([]);
    setCurrentActivity(null);
    setIsThinking(false);
    activityHistoryRef.current = [];
  }, []);
  
  return {
    // Connection state
    isConnected,
    lastUpdate,
    error,
    connectionStatus, // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
    reconnectAttempt,
    manualReconnect, // Function to manually trigger reconnection
    
    // Device presence
    connectedDevices,
    currentDeviceId,
    currentDeviceType,
    totalDevices,
    
    // Activity stream (for inline chat + Progress dock)
    activityEvents,
    currentActivity,
    isThinking,
    thinkingSteps,
    toolExecutions,
    fileChanges,
    clearActivityState,
  };
}

// Export types for consumers
export type { 
  AgentProgressUpdate, 
  ConnectedDevice, 
  UseAgentWebSocketOptions,
  ActivityEvent,
  ThinkingStep,
  ToolExecutionEvent,
  FileChangeEvent,
};
