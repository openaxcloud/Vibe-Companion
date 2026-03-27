/**
 * CM6Editor - CodeMirror 6 based code editor
 * Placeholder/stub component for mobile-compatible code editing
 */

import { ReactNode } from 'react';

export interface CM6EditorProps {
  value?: string;
  onChange?: (value: string) => void;
  onMount?: (view: any) => void;
  language?: string;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
  children?: ReactNode;
}

export function CM6Editor({
  value = '',
  onChange,
  onMount,
  language = 'javascript',
  readOnly = false,
  height = '100%',
  className = '',
  children,
}: CM6EditorProps) {
  return (
    <div
      className={`w-full ${className}`}
      style={{ height }}
      data-testid="cm6-editor"
    >
      <textarea
        defaultValue={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className="w-full h-full p-4 font-mono text-sm border border-gray-300 rounded"
        placeholder={`Enter ${language} code...`}
      />
      {children}
    </div>
  );
}
