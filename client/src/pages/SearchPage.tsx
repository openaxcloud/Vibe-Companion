import React from 'react';
import { ReplitLayout } from '@/components/layout/ReplitLayout';
import { AdvancedSearch } from '@/components/AdvancedSearch';
import { useLocation } from 'wouter';
import { useMemo } from 'react';

export default function SearchPage() {
  const [location] = useLocation();
  
  const query = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('q') || '';
  }, [location]);

  return (
    <ReplitLayout>
      <AdvancedSearch initialQuery={query} />
    </ReplitLayout>
  );
}