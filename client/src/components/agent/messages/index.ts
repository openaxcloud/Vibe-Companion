/**
 * Agent Messages Module
 * Professional-grade message components for AI Agent chat
 * 100% Replit-identical UX with rich formatting and interactions
 */

export * from './types';
export { MessageRenderer } from './MessageRenderer';
export { ThinkingMessage } from './ThinkingMessage';
export { TaskMessage } from './TaskMessage';
export { ActionMessage } from './ActionMessage';
export { RichMessageContent } from './RichMessageContent';
export { VibingAnimation } from './VibingAnimation';
export { CollapsibleSection, CodeCollapsible } from './CollapsibleSection';
export { ToolExecutionBadge, ToolExecutionList } from './ToolExecutionBadge';
export { FileDiffViewer, MultiFileDiff } from './FileDiffViewer';
export { FileDiffInline, MultiFileDiffInline, parseDiffString } from './FileDiffInline';
export type { FileDiffData, DiffLine, DiffHunk } from './FileDiffInline';
export { StreamingSkeleton, StreamingMessageSkeleton, StreamingThinkingSkeleton } from './StreamingSkeleton';
