import React from 'react';
import { LazyMotionDiv } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { DragItem } from '@/types/splits';
import { FileText, Folder } from 'lucide-react';

interface DragOverlayContentProps {
  item: DragItem;
  className?: string;
}

export function DragOverlayContent({ item, className }: DragOverlayContentProps) {
  if (item.type === 'tab' && item.tabInfo) {
    return (
      <LazyMotionDiv
        className={cn(
          "bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2",
          className
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
      >
        {item.tabInfo.icon || <FileText className="h-4 w-4" />}
        <span className="text-[13px] font-medium">{item.tabInfo.title}</span>
      </LazyMotionDiv>
    );
  }

  if (item.type === 'file') {
    return (
      <LazyMotionDiv
        className={cn(
          "bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center gap-2",
          className
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
      >
        <FileText className="h-4 w-4" />
        <span className="text-[13px] font-medium">{item.fileName || 'File'}</span>
      </LazyMotionDiv>
    );
  }

  if (item.type === 'pane') {
    return (
      <LazyMotionDiv
        className={cn(
          "bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-4 min-w-[200px] min-h-[100px]",
          className
        )}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Folder className="h-4 w-4" />
          <span className="text-[13px] font-medium">Pane</span>
        </div>
        <div className="text-[11px] text-gray-500">Drop to split or merge</div>
      </LazyMotionDiv>
    );
  }

  return null;
}