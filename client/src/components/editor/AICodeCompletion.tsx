import { useState } from 'react';

interface AICodeCompletionProps {
  editor: unknown;
  enabled: boolean;
  model?: string;
  autoTrigger?: boolean;
  confidenceThreshold?: number;
  onStatusChange?: (status: 'idle' | 'loading' | 'error') => void;
}

export function AICodeCompletion({
  enabled,
  onStatusChange,
}: AICodeCompletionProps) {
  return null;
}

export function useAICompletion(_editor: unknown) {
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [model, setModel] = useState('Claude Sonnet 4.5');
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);

  return {
    enabled,
    setEnabled,
    status,
    model,
    setModel,
    autoTrigger,
    setAutoTrigger,
    confidenceThreshold,
    setConfidenceThreshold,
    Component: () => (
      <AICodeCompletion
        editor={null}
        enabled={enabled}
        model={model}
        autoTrigger={autoTrigger}
        confidenceThreshold={confidenceThreshold}
        onStatusChange={setStatus}
      />
    ),
  };
}
