/**
 * Design System Components
 * Exports common UI components and patterns used across the application
 */

export type SearchOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
};

export type SearchResult = {
  match: string;
  line: number;
  column: number;
  endColumn: number;
};

// Re-export components that would be defined here
// For now, these are placeholders that individual files can customize
export { SearchReplace } from './SearchReplace';
export { StatusBar } from './StatusBar';
