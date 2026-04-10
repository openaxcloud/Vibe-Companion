import { useLocation } from 'wouter';
import { useMemo } from 'react';

export function useSearchParams() {
  const [location] = useLocation();
  
  return useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams;
  }, [location]);
}