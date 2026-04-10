/**
 * Virtual Scroll List - High Performance Component
 * Renders only visible items in the viewport
 * Supports 10,000+ items without lag
 */

import { useEffect, useRef, useState, useMemo, useCallback, memo, ReactNode, UIEvent } from 'react';

interface VirtualScrollListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number; // Number of items to render outside viewport
  className?: string;
  onEndReached?: () => void; // Infinite scroll
  endReachedThreshold?: number; // Pixels before end to trigger onEndReached
}

export function VirtualScrollList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 200,
}: VirtualScrollListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Optimized calculations with useMemo
  const { startIndex, endIndex, offsetY, totalHeight } = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * itemHeight,
      totalHeight: items.length * itemHeight,
    };
  }, [scrollTop, items.length, itemHeight, containerHeight, overscan]);

  // Visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  // Scroll handling
  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);

      // Infinite scroll
      if (onEndReached) {
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (scrollBottom < endReachedThreshold) {
          onEndReached();
        }
      }
    },
    [onEndReached, endReachedThreshold]
  );

  // Scroll to index
  const scrollToIndex = useCallback(
    (index: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = index * itemHeight;
      }
    },
    [itemHeight]
  );

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Virtual Grid - For displaying data grids
 */
interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  gap?: number;
  className?: string;
}

export function VirtualGrid<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 0,
  className = '',
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate number of columns
  const columns = useMemo(() => {
    return Math.floor((containerWidth + gap) / (itemWidth + gap));
  }, [containerWidth, itemWidth, gap]);

  // Calculate visible indices
  const { startRow, endRow, visibleItems, totalHeight, offsetY } = useMemo(() => {
    const rows = Math.ceil(items.length / columns);
    const visibleRows = Math.ceil(containerHeight / (itemHeight + gap));
    const currentRow = Math.floor(scrollTop / (itemHeight + gap));
    
    const start = Math.max(0, currentRow - 1);
    const end = Math.min(rows, currentRow + visibleRows + 1);
    
    const startIdx = start * columns;
    const endIdx = Math.min(items.length, end * columns);
    
    return {
      startRow: start,
      endRow: end,
      visibleItems: items.slice(startIdx, endIdx),
      totalHeight: rows * (itemHeight + gap),
      offsetY: start * (itemHeight + gap),
    };
  }, [items, columns, containerHeight, itemHeight, gap, scrollTop]);

  return (
    <div
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, ${itemWidth}px)`,
              gap: `${gap}px`,
            }}
          >
            {visibleItems.map((item, i) => {
              const actualIndex = startRow * columns + i;
              return (
                <div key={actualIndex} style={{ width: itemWidth, height: itemHeight }}>
                  {renderItem(item, actualIndex)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Virtual Tree - For displaying file trees
 */
interface TreeNode<T> {
  id: string;
  data: T;
  children?: TreeNode<T>[];
  expanded?: boolean;
}

interface VirtualTreeProps<T> {
  nodes: TreeNode<T>[];
  itemHeight: number;
  containerHeight: number;
  renderNode: (node: TreeNode<T>, depth: number) => ReactNode;
  onToggle?: (nodeId: string) => void;
  className?: string;
}

export function VirtualTree<T>({
  nodes,
  itemHeight,
  containerHeight,
  renderNode,
  onToggle,
  className = '',
}: VirtualTreeProps<T>) {
  // Flatten tree to list for virtual scrolling
  const flattenedNodes = useMemo(() => {
    const result: Array<{ node: TreeNode<T>; depth: number }> = [];

    const flatten = (nodes: TreeNode<T>[], depth: number) => {
      nodes.forEach((node) => {
        result.push({ node, depth });
        if (node.expanded && node.children) {
          flatten(node.children, depth + 1);
        }
      });
    };

    flatten(nodes, 0);
    return result;
  }, [nodes]);

  return (
    <VirtualScrollList
      items={flattenedNodes}
      itemHeight={itemHeight}
      containerHeight={containerHeight}
      renderItem={({ node, depth }) => renderNode(node, depth)}
      className={className}
    />
  );
}

/**
 * Hook to use Virtual Scroll with react-window alternative
 */
export function useVirtualScroll(
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight));
    const endIndex = Math.min(itemCount, startIndex + visibleCount);

    return {
      startIndex,
      endIndex,
      visibleCount,
      offsetY: startIndex * itemHeight,
      totalHeight: itemCount * itemHeight,
    };
  }, [scrollTop, itemCount, itemHeight, containerHeight]);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    ...visibleRange,
    handleScroll,
    scrollTop,
  };
}

/**
 * Memoized Virtual List Item
 */
export const VirtualListItem = memo(function VirtualListItem<T>({
  item,
  index,
  height,
  render,
}: {
  item: T;
  index: number;
  height: number;
  render: (item: T, index: number) => ReactNode;
}) {
  return <div style={{ height }}>{render(item, index)}</div>;
});

export default VirtualScrollList;
