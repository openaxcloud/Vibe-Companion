import { useState } from 'react';

interface ProblemsCount {
  errorsCount: number;
  warningsCount: number;
}

export function useProblemsCount(_projectId: string): ProblemsCount {
  // This would integrate with LSP diagnostics in a real implementation
  // For now, return zero counts
  return { errorsCount: 0, warningsCount: 0 };
}
