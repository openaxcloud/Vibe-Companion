type AgentEventType = 
  | 'agent:status'
  | 'agent:task'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:database-created'
  | 'agent:file-created'
  | 'agent:connected'
  | 'agent:disconnected'
  | 'agent:preview-ready';

interface AgentEvent {
  type: AgentEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

type AgentEventListener = (event: AgentEvent) => void;

class AgentEventBusClass {
  private listeners: Map<AgentEventType, Set<AgentEventListener>> = new Map();
  private globalListeners: Set<AgentEventListener> = new Set();

  emit(type: AgentEventType, payload: Record<string, unknown> = {}): void {
    const event: AgentEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          console.error(`[AgentEventBus] Error in listener for ${type}:`, err);
        }
      });
    }

    this.globalListeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[AgentEventBus] Error in global listener for ${type}:`, err);
      }
    });
  }

  on(type: AgentEventType, listener: AgentEventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  onAny(listener: AgentEventListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  off(type: AgentEventType, listener: AgentEventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  offAny(listener: AgentEventListener): void {
    this.globalListeners.delete(listener);
  }

  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

export const AgentEventBus = new AgentEventBusClass();
export type { AgentEventType, AgentEvent, AgentEventListener };
