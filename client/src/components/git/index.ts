// @ts-nocheck
/**
 * Advanced Git Components
 * VS Code-level git features for E-Code
 */

export { VisualDiffEditor } from './VisualDiffEditor';
export { GitGraph } from './GitGraph';
export { MergeConflictResolver } from './MergeConflictResolver';
export { BranchManager } from './BranchManager';
export { 
  GitBlameDecorator, 
  useGitBlame, 
  getBlameExtensions, 
  updateBlameData, 
  clearBlameData 
} from './GitBlameDecorator';

export type { GitCommitNode } from './GitGraph';
export type { ConflictBlock, ConflictFile } from './MergeConflictResolver';
export type { GitBranchInfo } from './BranchManager';
