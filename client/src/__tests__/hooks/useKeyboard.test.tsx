import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardHeight, useKeyboardVisible } from '@/hooks/use-keyboard';

describe('useKeyboard hooks', () => {
  it('useKeyboardHeight returns 0 when no keyboard', () => {
    const { result } = renderHook(() => useKeyboardHeight());
    expect(result.current).toBe(0);
  });

  it('useKeyboardVisible returns false when no keyboard', () => {
    const { result } = renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
  });
});
