// @ts-nocheck
/**
 * ToolsPanel - Lateral panel for discovering and accessing IDE tools
 * 
 * Provides a searchable, categorized view of all available tools
 * with descriptions, icons, and quick access
 */

import { useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TOOL_REGISTRY, getAllCategories, type ToolMetadata } from '@/lib/tool-registry';
import { cn } from '@/lib/utils';

interface ToolsPanelProps {
  availableTools: { id: string; label: string; icon: string }[];
  onSelectTool: (toolId: string) => void;
  activeTabs: string[];
  onClose?: () => void;
}

export function ToolsPanel({ 
  availableTools, 
  onSelectTool, 
  activeTabs,
  onClose 
}: ToolsPanelProps) {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Development', 'Tools', 'Security', 'Data', 'Deployment']) // Default expanded
  );

  // Get only tools that are actually available in the IDE
  const availableToolIds = new Set(availableTools.map(t => t.id));
  const allTools = Object.values(TOOL_REGISTRY)
    .filter(tool => availableToolIds.has(tool.id));

  // Filter tools based on search
  const filteredTools = search
    ? allTools.filter(tool =>
        tool.label.toLowerCase().includes(search.toLowerCase()) ||
        tool.description.toLowerCase().includes(search.toLowerCase()) ||
        tool.keywords?.some(k => k.toLowerCase().includes(search.toLowerCase()))
      )
    : allTools;

  // Group by category
  const categories = getAllCategories();
  const groupedTools = categories.reduce((acc, category) => {
    const tools = filteredTools.filter(t => t.category === category);
    if (tools.length > 0) {
      acc[category] = tools;
    }
    return acc;
  }, {} as Record<string, ToolMetadata[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleToolClick = (toolId: string) => {
    onSelectTool(toolId);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--ecode-surface)] border-l border-[var(--ecode-border)]">
      {/* Header */}
      <div className="h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 bg-[var(--ecode-surface)]">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--ecode-accent)]" />
          <h2 className="text-xs font-medium text-[var(--ecode-text-muted)]">Tools</h2>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-[var(--ecode-text-muted)] hover:text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
            data-testid="button-close-tools-panel"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      
      {/* Search */}
      <div className="p-2.5 border-b border-[var(--ecode-border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-[13px]"
            data-testid="input-search-tools"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearch('')}
              className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-[var(--ecode-sidebar-hover)]"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Tools List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {Object.entries(groupedTools).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--ecode-text-muted)]">
              <Sparkles className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-[13px] font-medium">No tools found</p>
              <p className="text-[11px] mt-1">Try a different search</p>
            </div>
          ) : (
            Object.entries(groupedTools).map(([category, tools]) => (
              <Collapsible
                key={category}
                open={expandedCategories.has(category)}
                onOpenChange={() => toggleCategory(category)}
                className="mb-2"
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-[var(--ecode-sidebar-hover)] transition-colors">
                  <span className="text-[11px] font-semibold text-[var(--ecode-text-muted)] uppercase tracking-wide">
                    {category}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-4 text-[11px] px-1.5">
                      {tools.length}
                    </Badge>
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--ecode-text-muted)]" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-1 space-y-0.5">
                  {tools.map((tool) => {
                    const IconComponent = tool.icon;
                    const isActive = activeTabs.includes(tool.id);
                    
                    return (
                      <button
                        key={tool.id}
                        onClick={() => handleToolClick(tool.id)}
                        data-testid={`tool-${tool.id}`}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-md transition-all duration-150 flex items-start gap-3 group",
                          isActive
                            ? "bg-[var(--ecode-sidebar-hover)] shadow-sm border border-[var(--ecode-border)]"
                            : "hover:bg-[var(--ecode-sidebar-hover)]"
                        )}
                      >
                        <IconComponent
                          className={cn(
                            "w-4 h-4 flex-shrink-0 mt-0.5 transition-all duration-200",
                            isActive
                              ? "text-[var(--ecode-accent)] scale-110"
                              : "text-[var(--ecode-text-muted)] group-hover:text-[var(--ecode-accent)] group-hover:scale-110"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn(
                              "text-[13px] font-medium truncate",
                              isActive && "font-semibold"
                            )}>
                              {tool.label}
                            </span>
                            {tool.badge && (
                              <Badge 
                                variant={tool.badge === 'PRO' ? 'default' : 'secondary'}
                                className="h-4 text-[11px] px-1.5 flex-shrink-0"
                              >
                                {tool.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--ecode-text-muted)] line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-1 h-1 rounded-full bg-[var(--ecode-accent)] flex-shrink-0 mt-2" />
                        )}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-[var(--ecode-border)] bg-[var(--ecode-sidebar-bg)]">
        <div className="flex items-center justify-between text-[11px] text-[var(--ecode-text-muted)]">
          <span>
            {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} available
          </span>
          {activeTabs.length > 0 && (
            <span>{activeTabs.length} active</span>
          )}
        </div>
      </div>
    </div>
  );
}
