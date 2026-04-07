import { useRef, useState, useEffect } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useNativeMotionValue } from '@/lib/native-motion';
import { 
  GitBranch, Bug, Settings, Database,
  Share2, Users, X,
  Globe, Package, Search, Shield, Key,
  Workflow, History, Puzzle, RotateCcw,
  Zap, Layers, Rocket, Command, Keyboard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useReducedMotion, SPRING_CONFIG, getReducedMotionTransition, DURATION_CONFIG } from '@/hooks/use-reduced-motion';

interface MobileMoreMenuProps {
  projectId: string | number;
  isOpen: boolean;
  onClose: () => void;
  onOpenFiles?: () => void;
  onOpenCollaboration?: () => void;
  onOpenGit?: () => void;
  onOpenPackages?: () => void;
  onOpenSecrets?: () => void;
  onOpenDatabase?: () => void;
  onOpenSettings?: () => void;
  onOpenDebug?: () => void;
  onOpenSecurity?: () => void;
  onOpenWorkflows?: () => void;
  onOpenHistory?: () => void;
  onOpenCheckpoints?: () => void;
  onOpenExtensions?: () => void;
  onOpenActions?: () => void;
  onOpenTools?: () => void;
  onOpenDeploy?: () => void;
  onOpenWeb?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenGlobalSearch?: () => void;
  onOpenQuickFileSearch?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  problemsCount?: number;
  className?: string;
  /** Render as inline content instead of fixed overlay */
  inline?: boolean;
}

interface MenuItem {
  id: string;
  label: string;
  icon: typeof GitBranch;
  badge?: string | number;
  onClick: () => void;
}

export function MobileMoreMenu({ 
  projectId,
  isOpen,
  onClose,
  onOpenCollaboration,
  onOpenGit,
  onOpenPackages,
  onOpenSecrets,
  onOpenDatabase,
  onOpenSettings,
  onOpenDebug,
  onOpenSecurity,
  onOpenWorkflows,
  onOpenHistory,
  onOpenCheckpoints,
  onOpenExtensions,
  onOpenActions,
  onOpenTools,
  onOpenDeploy,
  onOpenWeb,
  onOpenCommandPalette,
  onOpenGlobalSearch,
  problemsCount = 0,
  className,
  inline = false,
}: MobileMoreMenuProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  
  const dragY = useNativeMotionValue(0);
  const [dragStyles, setDragStyles] = useState({ y: 0, opacity: 1, scale: 1 });
  
  useEffect(() => {
    const unsubscribe = dragY.subscribe((value) => {
      if (typeof value !== 'number' || isNaN(value)) {
        setDragStyles({ y: 0, opacity: 1, scale: 1 });
        return;
      }
      const clamped = Math.max(0, Math.min(150, value));
      const opacity = 1 - (clamped / 150) * 0.5;
      const scale = 1 - (clamped / 150) * 0.02;
      setDragStyles({ y: value, opacity, scale });
    });
    return unsubscribe;
  }, [dragY]);
  
  const startY = useRef(0);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(Date.now());
  const CLOSE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 500;

  const handleDragStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
  };

  const handleDrag = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const currentTime = Date.now();
    const distance = currentY - startY.current;
    const timeDelta = currentTime - lastTime.current;
    
    if (timeDelta > 0) {
      velocity.current = (currentY - lastY.current) / timeDelta * 1000;
    }
    
    lastY.current = currentY;
    lastTime.current = currentTime;
    
    if (distance > 0) {
      dragY.set(distance);
    }
  };

  const handleDragEnd = () => {
    const currentOffset = dragY.get();
    const shouldClose = currentOffset >= CLOSE_THRESHOLD || velocity.current >= VELOCITY_THRESHOLD;
    
    if (shouldClose) {
      onClose();
    }
    
    dragY.set(0);
    velocity.current = 0;
  };

  const handleShareLink = async () => {
    try {
      const shareUrl = `${window.location.origin}/projects/${projectId}`;
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link Copied', description: 'Project link copied to clipboard' });
      if (!inline) onClose();
    } catch (error) {
      toast({ 
        title: 'Copy Failed', 
        description: 'Failed to copy link to clipboard',
        variant: 'destructive'
      });
    }
  };

  const menuItems: MenuItem[] = [
    { 
      id: 'web', 
      label: 'Web', 
      icon: Globe, 
      onClick: () => {
        if (onOpenWeb) onOpenWeb();
        if (!inline) onClose();
      }
    },
    { 
      id: 'deploy', 
      label: 'Deploy', 
      icon: Rocket, 
      onClick: () => {
        if (onOpenDeploy) onOpenDeploy();
        if (!inline) onClose();
      }
    },
    { 
      id: 'git', 
      label: 'Git', 
      icon: GitBranch, 
      onClick: () => {
        if (onOpenGit) onOpenGit();
        if (!inline) onClose();
      }
    },
    { 
      id: 'packages', 
      label: 'Packages', 
      icon: Package, 
      onClick: () => {
        if (onOpenPackages) onOpenPackages();
        if (!inline) onClose();
      }
    },
    { 
      id: 'database', 
      label: 'Database', 
      icon: Database, 
      onClick: () => {
        if (onOpenDatabase) onOpenDatabase();
        if (!inline) onClose();
      }
    },
    { 
      id: 'secrets', 
      label: 'Secrets', 
      icon: Key, 
      onClick: () => {
        if (onOpenSecrets) onOpenSecrets();
        if (!inline) onClose();
      }
    },
    { 
      id: 'debug', 
      label: 'Debug', 
      icon: Bug, 
      badge: problemsCount > 0 ? problemsCount : undefined,
      onClick: () => {
        if (onOpenDebug) onOpenDebug();
        if (!inline) onClose();
      }
    },
    { 
      id: 'search', 
      label: 'Search', 
      icon: Search, 
      onClick: () => {
        if (onOpenGlobalSearch) onOpenGlobalSearch();
        if (!inline) onClose();
      }
    },
    { 
      id: 'commands', 
      label: 'Commands', 
      icon: Command, 
      onClick: () => {
        if (onOpenCommandPalette) onOpenCommandPalette();
        if (!inline) onClose();
      }
    },
    { 
      id: 'workflows', 
      label: 'Workflows', 
      icon: Workflow, 
      onClick: () => {
        if (onOpenWorkflows) onOpenWorkflows();
        if (!inline) onClose();
      }
    },
    { 
      id: 'actions', 
      label: 'Actions', 
      icon: Zap, 
      onClick: () => {
        if (onOpenActions) onOpenActions();
        if (!inline) onClose();
      }
    },
    { 
      id: 'tools', 
      label: 'Tools', 
      icon: Layers, 
      onClick: () => {
        if (onOpenTools) onOpenTools();
        if (!inline) onClose();
      }
    },
    { 
      id: 'collaborate', 
      label: 'Collaborate', 
      icon: Users, 
      onClick: () => {
        if (onOpenCollaboration) onOpenCollaboration();
        if (!inline) onClose();
      }
    },
    { 
      id: 'share', 
      label: 'Share', 
      icon: Share2, 
      onClick: handleShareLink
    },
    { 
      id: 'history', 
      label: 'History', 
      icon: History, 
      onClick: () => {
        if (onOpenHistory) onOpenHistory();
        if (!inline) onClose();
      }
    },
    { 
      id: 'checkpoints', 
      label: 'Checkpoints', 
      icon: RotateCcw, 
      onClick: () => {
        if (onOpenCheckpoints) onOpenCheckpoints();
        if (!inline) onClose();
      }
    },
    { 
      id: 'extensions', 
      label: 'Extensions', 
      icon: Puzzle, 
      onClick: () => {
        if (onOpenExtensions) onOpenExtensions();
        if (!inline) onClose();
      }
    },
    { 
      id: 'security', 
      label: 'Security', 
      icon: Shield, 
      onClick: () => {
        if (onOpenSecurity) onOpenSecurity();
        if (!inline) onClose();
      }
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: Settings, 
      onClick: () => {
        if (onOpenSettings) onOpenSettings();
        if (!inline) onClose();
      }
    },
  ];

  const sheetVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { y: '100%' },
        visible: { 
          y: 0,
          transition: {
            type: 'spring',
            stiffness: 400,
            damping: 28,
            mass: 0.8,
          }
        },
      };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const itemVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      };

  const containerVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 1 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 1 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.02,
            delayChildren: 0.05,
          },
        },
      };

  if (inline && isOpen) {
    return (
      <div 
        className={cn('h-full flex flex-col bg-background', className)}
        data-testid="mobile-more-menu-inline"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Tools</h2>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-4 gap-3 p-4 pb-safe">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation min-h-[80px]"
                onClick={item.onClick}
                data-testid={`mobile-more-menu-${item.id}`}
              >
                <div className="relative w-11 h-11 flex items-center justify-center bg-muted rounded-xl">
                  <item.icon className="h-5 w-5 text-foreground" />
                  {item.badge !== undefined && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-medium text-center">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          <LazyMotionDiv
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: prefersReducedMotion ? 0.01 : DURATION_CONFIG.normal }}
            onClick={onClose}
            data-testid="mobile-more-menu-backdrop"
          />
          
          <LazyMotionDiv
            className={cn(
              'fixed bottom-0 left-0 right-0 bg-card dark:bg-[var(--ecode-surface)] rounded-t-2xl shadow-2xl z-[70] max-h-[70vh] flex flex-col',
              className
            )}
            variants={sheetVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={prefersReducedMotion ? {} : { 
              y: dragStyles.y, 
              opacity: dragStyles.opacity,
              scale: dragStyles.scale,
            }}
            data-testid="mobile-more-menu-sheet"
          >
            <div 
              className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none"
              onTouchStart={handleDragStart}
              onTouchMove={handleDrag}
              onTouchEnd={handleDragEnd}
              data-testid="mobile-more-menu-handle"
            >
              <LazyMotionDiv 
                className="w-12 h-1 bg-muted-foreground/30 rounded-full"
                whileHover={prefersReducedMotion ? {} : { scaleX: 1.2 }}
                transition={SPRING_CONFIG.default}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <h2 className="font-semibold text-foreground">Tools</h2>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 hover:bg-muted touch-manipulation"
                onClick={onClose}
                data-testid="mobile-more-menu-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto mobile-hide-scrollbar">
              <LazyMotionDiv 
                className="grid grid-cols-4 gap-2 p-4 pb-safe"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {menuItems.map((item) => (
                  <LazyMotionButton
                    key={item.id}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors touch-manipulation"
                    onClick={item.onClick}
                    variants={itemVariants}
                    whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                    transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.default)}
                    data-testid={`mobile-more-menu-${item.id}`}
                  >
                    <div className="relative w-10 h-10 flex items-center justify-center bg-muted rounded-xl">
                      <item.icon className="h-5 w-5 text-foreground" />
                      {item.badge !== undefined && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-medium text-center">
                      {item.label}
                    </span>
                  </LazyMotionButton>
                ))}
              </LazyMotionDiv>
            </ScrollArea>
          </LazyMotionDiv>
        </>
      )}
    </LazyAnimatePresence>
  );
}
