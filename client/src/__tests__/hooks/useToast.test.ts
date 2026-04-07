import { describe, it, expect, beforeEach } from 'vitest';
import { reducer } from '@/hooks/use-toast';

describe('Toast Reducer', () => {
  const initialState = { toasts: [] };

  beforeEach(() => {
  });

  describe('ADD_TOAST action', () => {
    it('should add a toast to empty state', () => {
      const action = {
        type: 'ADD_TOAST' as const,
        toast: { id: '1', title: 'Test Toast', open: true }
      };
      
      const result = reducer(initialState, action);
      
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('1');
      expect(result.toasts[0].title).toBe('Test Toast');
    });

    it('should add multiple toasts', () => {
      const state1 = reducer(initialState, {
        type: 'ADD_TOAST' as const,
        toast: { id: '1', title: 'First', open: true }
      });
      
      const state2 = reducer(state1, {
        type: 'ADD_TOAST' as const,
        toast: { id: '2', title: 'Second', open: true }
      });
      
      expect(state2.toasts).toHaveLength(2);
    });
  });

  describe('UPDATE_TOAST action', () => {
    it('should update an existing toast', () => {
      const stateWithToast = {
        toasts: [{ id: '1', title: 'Original', open: true }]
      };
      
      const result = reducer(stateWithToast, {
        type: 'UPDATE_TOAST' as const,
        toast: { id: '1', title: 'Updated' }
      });
      
      expect(result.toasts[0].title).toBe('Updated');
    });

    it('should not affect other toasts', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true }
        ]
      };
      
      const result = reducer(stateWithToasts, {
        type: 'UPDATE_TOAST' as const,
        toast: { id: '1', title: 'Updated First' }
      });
      
      expect(result.toasts[0].title).toBe('Updated First');
      expect(result.toasts[1].title).toBe('Second');
    });
  });

  describe('DISMISS_TOAST action', () => {
    it('should set open to false for specific toast', () => {
      const stateWithToast = {
        toasts: [{ id: '1', title: 'Test', open: true }]
      };
      
      const result = reducer(stateWithToast, {
        type: 'DISMISS_TOAST' as const,
        toastId: '1'
      });
      
      expect(result.toasts[0].open).toBe(false);
    });

    it('should dismiss all toasts when no toastId provided', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true }
        ]
      };
      
      const result = reducer(stateWithToasts, {
        type: 'DISMISS_TOAST' as const,
        toastId: undefined
      });
      
      expect(result.toasts[0].open).toBe(false);
      expect(result.toasts[1].open).toBe(false);
    });
  });

  describe('REMOVE_TOAST action', () => {
    it('should remove a specific toast', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true }
        ]
      };
      
      const result = reducer(stateWithToasts, {
        type: 'REMOVE_TOAST' as const,
        toastId: '1'
      });
      
      expect(result.toasts).toHaveLength(1);
      expect(result.toasts[0].id).toBe('2');
    });

    it('should remove all toasts when toastId is undefined', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true }
        ]
      };
      
      const result = reducer(stateWithToasts, {
        type: 'REMOVE_TOAST' as const,
        toastId: undefined
      });
      
      expect(result.toasts).toHaveLength(0);
    });
  });
});
