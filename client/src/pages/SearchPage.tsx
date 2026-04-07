import React from 'react';
import { AdvancedSearch } from '@/components/AdvancedSearch';
import { useLocation } from 'wouter';
import { useMemo } from 'react';

export default function SearchPage() {
  const [location] = useLocation();
  
  const query = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('q') || '';
  }, [location]);

  return <AdvancedSearch initialQuery={query} />;
}