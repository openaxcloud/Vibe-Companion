import { useState, useEffect } from 'react';

interface ProblemsCount {
  errorsCount: number;
  warningsCount: number;
}

const problemsStore: Record<string, ProblemsCount> = {};

export function updateProblemsCount(projectId: string, errors: number, warnings: number) {
  problemsStore[projectId] = { errorsCount: errors, warningsCount: warnings };
  window.dispatchEvent(new CustomEvent('ecode:problems-updated', { detail: { projectId } }));
}

export function useProblemsCount(projectId: string): ProblemsCount {
  const [counts, setCounts] = useState<ProblemsCount>(
    problemsStore[projectId] || { errorsCount: 0, warningsCount: 0 }
  );

  useEffect(() => {
    setCounts(problemsStore[projectId] || { errorsCount: 0, warningsCount: 0 });
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === projectId) {
        setCounts({ ...problemsStore[projectId] });
      }
    };
    window.addEventListener('ecode:problems-updated', handler);
    return () => window.removeEventListener('ecode:problems-updated', handler);
  }, [projectId]);

  return counts;
}
