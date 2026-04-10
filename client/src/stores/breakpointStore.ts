import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  enabled: boolean;
}

interface BreakpointStore {
  breakpoints: Breakpoint[];
  addBreakpoint: (bp: Omit<Breakpoint, 'id'>) => void;
  removeBreakpoint: (id: string) => void;
  toggleBreakpoint: (id: string) => void;
  updateCondition: (id: string, condition: string) => void;
}

export const useBreakpointStore = create<BreakpointStore>()(
  persist(
    (set) => ({
      breakpoints: [],
      addBreakpoint: (bp) => set((state) => ({
        breakpoints: [...state.breakpoints, { ...bp, id: crypto.randomUUID() }]
      })),
      removeBreakpoint: (id) => set((state) => ({
        breakpoints: state.breakpoints.filter(b => b.id !== id)
      })),
      toggleBreakpoint: (id) => set((state) => ({
        breakpoints: state.breakpoints.map(b => 
          b.id === id ? { ...b, enabled: !b.enabled } : b
        )
      })),
      updateCondition: (id, condition) => set((state) => ({
        breakpoints: state.breakpoints.map(b => 
          b.id === id ? { ...b, condition } : b
        )
      })),
    }),
    { name: 'ecode-breakpoints' }
  )
);

export type { Breakpoint, BreakpointStore };
