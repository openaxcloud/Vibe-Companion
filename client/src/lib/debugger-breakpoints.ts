import { create } from 'zustand';

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  enabled: boolean;
  hitCount?: number;
}

interface BreakpointStore {
  breakpoints: Map<string, Breakpoint[]>;
  
  addBreakpoint: (file: string, line: number, condition?: string) => Breakpoint;
  removeBreakpoint: (file: string, breakpointId: string) => void;
  toggleBreakpoint: (file: string, breakpointId: string) => void;
  getBreakpoints: (file: string) => Breakpoint[];
  getAllBreakpoints: () => Breakpoint[];
  clearBreakpoints: (file?: string) => void;
  updateBreakpointCondition: (file: string, breakpointId: string, condition: string) => void;
}

export const useBreakpointStore = create<BreakpointStore>((set, get) => ({
  breakpoints: new Map(),

  addBreakpoint: (file: string, line: number, condition?: string) => {
    const id = `bp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const breakpoint: Breakpoint = {
      id,
      file,
      line,
      condition,
      enabled: true,
      hitCount: 0,
    };

    set((state) => {
      const newBreakpoints = new Map(state.breakpoints);
      const fileBreakpoints = newBreakpoints.get(file) || [];
      
      if (!fileBreakpoints.some(bp => bp.line === line)) {
        newBreakpoints.set(file, [...fileBreakpoints, breakpoint]);
      }
      
      return { breakpoints: newBreakpoints };
    });

    return breakpoint;
  },

  removeBreakpoint: (file: string, breakpointId: string) => {
    set((state) => {
      const newBreakpoints = new Map(state.breakpoints);
      const fileBreakpoints = newBreakpoints.get(file) || [];
      newBreakpoints.set(file, fileBreakpoints.filter(bp => bp.id !== breakpointId));
      return { breakpoints: newBreakpoints };
    });
  },

  toggleBreakpoint: (file: string, breakpointId: string) => {
    set((state) => {
      const newBreakpoints = new Map(state.breakpoints);
      const fileBreakpoints = newBreakpoints.get(file) || [];
      newBreakpoints.set(
        file,
        fileBreakpoints.map(bp =>
          bp.id === breakpointId ? { ...bp, enabled: !bp.enabled } : bp
        )
      );
      return { breakpoints: newBreakpoints };
    });
  },

  getBreakpoints: (file: string) => {
    return get().breakpoints.get(file) || [];
  },

  getAllBreakpoints: () => {
    const all: Breakpoint[] = [];
    get().breakpoints.forEach((bps) => all.push(...bps));
    return all;
  },

  clearBreakpoints: (file?: string) => {
    set((state) => {
      if (file) {
        const newBreakpoints = new Map(state.breakpoints);
        newBreakpoints.delete(file);
        return { breakpoints: newBreakpoints };
      }
      return { breakpoints: new Map() };
    });
  },

  updateBreakpointCondition: (file: string, breakpointId: string, condition: string) => {
    set((state) => {
      const newBreakpoints = new Map(state.breakpoints);
      const fileBreakpoints = newBreakpoints.get(file) || [];
      newBreakpoints.set(
        file,
        fileBreakpoints.map(bp =>
          bp.id === breakpointId ? { ...bp, condition } : bp
        )
      );
      return { breakpoints: newBreakpoints };
    });
  },
}));
