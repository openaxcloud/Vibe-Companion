/**
 * Search & Replace Component
 * Advanced search with regex support for code editors
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface SearchReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, options: SearchOptions) => SearchResult[];
  onReplace: (query: string, replacement: string, options: SearchOptions) => number;
  onReplaceAll: (query: string, replacement: string, options: SearchOptions) => number;
  initialQuery?: string;
}

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

export interface SearchResult {
  line: number;
  column: number;
  length: number;
  text: string;
}

// ============================================================================
// SEARCH & REPLACE COMPONENT
// ============================================================================

export const SearchReplace: React.FC<SearchReplaceProps> = ({
  isOpen,
  onClose,
  onSearch,
  onReplace,
  onReplaceAll,
  initialQuery = '',
}) => {
  const ds = useDesignSystem();
  const [query, setQuery] = useState(initialQuery);
  const [replacement, setReplacement] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);

  const [options, setOptions] = useState<SearchOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [isOpen]);

  // Perform search when query or options change
  useEffect(() => {
    if (query) {
      try {
        const searchResults = onSearch(query, options);
        setResults(searchResults);
        setCurrentResultIndex(0);
      } catch (error) {
        // Invalid regex
        setResults([]);
      }
    } else {
      setResults([]);
    }
  }, [query, options, onSearch]);

  const handleClose = useCallback(() => {
    triggerHaptic('selection');
    onClose();
  }, [onClose]);

  const handleToggleReplace = useCallback(() => {
    triggerHaptic('selection');
    setShowReplace(!showReplace);
    if (!showReplace) {
      setTimeout(() => replaceInputRef.current?.focus(), 100);
    }
  }, [showReplace]);

  const handlePrevious = useCallback(() => {
    if (results.length > 0) {
      triggerHaptic('selection');
      setCurrentResultIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1
      );
    }
  }, [results.length]);

  const handleNext = useCallback(() => {
    if (results.length > 0) {
      triggerHaptic('selection');
      setCurrentResultIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0
      );
    }
  }, [results.length]);

  const handleReplace = useCallback(() => {
    if (query && replacement !== undefined) {
      triggerHaptic('medium');
      const count = onReplace(query, replacement, options);
      if (count > 0) {
        // Refresh search results
        const searchResults = onSearch(query, options);
        setResults(searchResults);
      }
    }
  }, [query, replacement, options, onReplace, onSearch]);

  const handleReplaceAll = useCallback(() => {
    if (query && replacement !== undefined) {
      triggerHaptic('medium');
      const count = onReplaceAll(query, replacement, options);
      // Clear results after replace all
      setResults([]);
      setQuery('');
      setReplacement('');
    }
  }, [query, replacement, options, onReplaceAll]);

  const toggleOption = useCallback((option: keyof SearchOptions) => {
    triggerHaptic('light');
    setOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          e.preventDefault();
          handlePrevious();
        } else if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          handleNext();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        handleToggleReplace();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handlePrevious, handleNext, handleToggleReplace]);

  if (!isOpen) return null;

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: ds.zIndex.sticky,
        backgroundColor: ds.colors.background.elevated,
        borderRadius: ds.borderRadius.lg,
        boxShadow: ds.shadows.xl,
        padding: ds.spacing[4],
        margin: ds.spacing[4],
        minWidth: ds.device.isMobile ? '90vw' : '400px',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        border: ds.isDark
          ? `1px solid ${ds.colors.separator.opaque}`
          : 'none',
      }}
    >
      {/* Search Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ds.spacing[3],
          marginBottom: showReplace ? ds.spacing[3] : 0,
        }}
      >
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find"
          style={{
            ...ds.typography.textStyles.callout,
            flex: 1,
            padding: `${ds.spacing[3]} ${ds.spacing[4]}`,
            backgroundColor: ds.colors.fill.tertiary,
            border: 'none',
            borderRadius: ds.borderRadius.md,
            color: ds.colors.text.primary,
            outline: 'none',
          }}
        />

        {/* Result counter */}
        {results.length > 0 && (
          <div
            style={{
              ...ds.typography.textStyles.caption1,
              color: ds.colors.text.secondary,
              whiteSpace: 'nowrap',
            }}
          >
            {currentResultIndex + 1} of {results.length}
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: ds.spacing[2] }}>
          <OptionButton
            icon="↑"
            active={false}
            onClick={handlePrevious}
            disabled={results.length === 0}
            tooltip="Previous (Shift+Enter)"
          />
          <OptionButton
            icon="↓"
            active={false}
            onClick={handleNext}
            disabled={results.length === 0}
            tooltip="Next (Enter)"
          />
        </div>

        {/* Close button */}
        <OptionButton
          icon="✕"
          active={false}
          onClick={handleClose}
          tooltip="Close (Esc)"
        />
      </div>

      {/* Replace Input */}
      <div
        className={`collapsible-content ${showReplace ? 'expanded' : ''}`}
        style={{ marginBottom: showReplace ? ds.spacing[3] : 0 }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: ds.spacing[3],
            }}
          >
            <input
              ref={replaceInputRef}
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Replace"
              style={{
                ...ds.typography.textStyles.callout,
                flex: 1,
                padding: `${ds.spacing[3]} ${ds.spacing[4]}`,
                backgroundColor: ds.colors.fill.tertiary,
                border: 'none',
                borderRadius: ds.borderRadius.md,
                color: ds.colors.text.primary,
                outline: 'none',
              }}
            />

            <button
              onClick={handleReplace}
              disabled={results.length === 0}
              className="tap-scale"
              style={{
                ...ds.typography.textStyles.caption1,
                padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
                backgroundColor: ds.colors.interactive.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: ds.borderRadius.sm,
                cursor: results.length === 0 ? 'not-allowed' : 'pointer',
                opacity: results.length === 0 ? 0.5 : 1,
              }}
            >
              Replace
            </button>

            <button
              onClick={handleReplaceAll}
              disabled={results.length === 0}
              className="tap-scale"
              style={{
                ...ds.typography.textStyles.caption1,
                padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
                backgroundColor: ds.colors.interactive.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: ds.borderRadius.sm,
                cursor: results.length === 0 ? 'not-allowed' : 'pointer',
                opacity: results.length === 0 ? 0.5 : 1,
              }}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Options */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: ds.spacing[3],
        }}
      >
        <div style={{ display: 'flex', gap: ds.spacing[2] }}>
          <OptionButton
            icon="Aa"
            active={options.caseSensitive}
            onClick={() => toggleOption('caseSensitive')}
            tooltip="Match Case"
          />
          <OptionButton
            icon="⎵"
            active={options.wholeWord}
            onClick={() => toggleOption('wholeWord')}
            tooltip="Match Whole Word"
          />
          <OptionButton
            icon=".*"
            active={options.useRegex}
            onClick={() => toggleOption('useRegex')}
            tooltip="Use Regular Expression"
          />
        </div>

        <LazyMotionButton
          onClick={handleToggleReplace}
          whileTap={{ scale: 0.95 }}
          style={{
            ...ds.typography.textStyles.caption1,
            padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
            backgroundColor: showReplace
              ? ds.colors.fill.secondary
              : 'transparent',
            color: ds.colors.text.primary,
            border: 'none',
            borderRadius: ds.borderRadius.sm,
            cursor: 'pointer',
          }}
        >
          {showReplace ? '−' : '+'} Replace
        </LazyMotionButton>
      </div>
    </LazyMotionDiv>
  );
};

// ============================================================================
// OPTION BUTTON
// ============================================================================

interface OptionButtonProps {
  icon: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

const OptionButton: React.FC<OptionButtonProps> = ({
  icon,
  active,
  onClick,
  disabled = false,
  tooltip,
}) => {
  const ds = useDesignSystem();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <LazyMotionButton
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
        style={{
          ...ds.typography.textStyles.caption1,
          fontWeight: 600,
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: active
            ? ds.colors.interactive.primary
            : ds.colors.fill.tertiary,
          color: active ? '#FFFFFF' : ds.colors.text.primary,
          border: 'none',
          borderRadius: ds.borderRadius.sm,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {icon}
      </LazyMotionButton>

      {/* Tooltip */}
      <LazyAnimatePresence>
        {tooltip && showTooltip && !ds.device.isTouch && (
          <LazyMotionDiv
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: ds.spacing[2],
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              backgroundColor: ds.colors.background.elevated,
              borderRadius: ds.borderRadius.md,
              boxShadow: ds.shadows.lg,
              fontSize: ds.typography.textStyles.caption2.fontSize,
              color: ds.colors.text.primary,
              whiteSpace: 'nowrap',
              zIndex: ds.zIndex.tooltip,
              pointerEvents: 'none',
            }}
          >
            {tooltip}
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </div>
  );
};

export default SearchReplace;
