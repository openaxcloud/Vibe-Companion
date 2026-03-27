// @ts-nocheck
import { LucideIcon, FolderOpen, Code, Terminal, Search, FileX, Inbox, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LazyMotionDiv } from '@/lib/motion';
import { useReducedMotion, getReducedMotionTransition, SPRING_CONFIG } from '@/hooks/use-reduced-motion';

export type EmptyStateVariant = 
  | 'no-files' 
  | 'no-project' 
  | 'empty-terminal' 
  | 'no-search-results'
  | 'no-content'
  | 'error'
  | 'custom';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  testId?: string;
}

interface MobileEmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  iconClassName?: string;
  compact?: boolean;
  testId?: string;
}

const defaultConfigs: Record<Exclude<EmptyStateVariant, 'custom'>, { icon: LucideIcon; title: string; description: string }> = {
  'no-files': {
    icon: FolderOpen,
    title: 'Aucun fichier',
    description: 'Ce projet ne contient pas encore de fichiers. Créez votre premier fichier pour commencer.',
  },
  'no-project': {
    icon: Code,
    title: 'Aucun projet',
    description: 'Vous n\'avez pas encore de projet. Créez-en un pour commencer à coder.',
  },
  'empty-terminal': {
    icon: Terminal,
    title: 'Terminal vide',
    description: 'Exécutez une commande pour voir la sortie ici.',
  },
  'no-search-results': {
    icon: Search,
    title: 'Aucun résultat',
    description: 'Aucun fichier ne correspond à votre recherche. Essayez avec d\'autres termes.',
  },
  'no-content': {
    icon: Inbox,
    title: 'Aucun contenu',
    description: 'Il n\'y a rien à afficher pour le moment.',
  },
  'error': {
    icon: AlertCircle,
    title: 'Une erreur est survenue',
    description: 'Impossible de charger le contenu. Veuillez réessayer.',
  },
};

export function MobileEmptyState({
  variant = 'custom',
  icon: CustomIcon,
  title: customTitle,
  description: customDescription,
  action,
  secondaryAction,
  className,
  iconClassName,
  compact = false,
  testId,
}: MobileEmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const config = variant !== 'custom' ? defaultConfigs[variant] : null;
  const Icon = CustomIcon || config?.icon || FileX;
  const title = customTitle || config?.title || 'Aucun contenu';
  const description = customDescription || config?.description || '';
  
  const containerVariants = {
    initial: { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
    animate: { opacity: 1, y: 0 },
  };
  
  const iconVariants = {
    initial: { scale: prefersReducedMotion ? 1 : 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
  };
  
  return (
    <LazyMotionDiv
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6 gap-3' : 'px-6 py-10 gap-4',
        className
      )}
      variants={containerVariants}
      initial="initial"
      animate="animate"
      transition={getReducedMotionTransition(prefersReducedMotion, SPRING_CONFIG.gentle)}
      data-testid={testId || `empty-state-${variant}`}
    >
      <LazyMotionDiv
        className={cn(
          'flex items-center justify-center rounded-full bg-surface-solid',
          compact ? 'w-12 h-12' : 'w-16 h-16'
        )}
        variants={iconVariants}
        transition={prefersReducedMotion 
          ? { duration: 0.01 } 
          : { ...SPRING_CONFIG.bouncy, delay: 0.1 }
        }
      >
        <Icon 
          className={cn(
            'text-muted-foreground',
            compact ? 'h-6 w-6' : 'h-8 w-8',
            iconClassName
          )} 
        />
      </LazyMotionDiv>
      
      <div className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
        <h3 
          className={cn(
            'font-semibold text-foreground',
            compact ? 'text-[13px]' : 'text-[15px]'
          )}
        >
          {title}
        </h3>
        
        {description && (
          <p 
            className={cn(
              'text-muted-foreground max-w-[280px]',
              compact ? 'text-[11px]' : 'text-[13px]'
            )}
          >
            {description}
          </p>
        )}
      </div>
      
      {(action || secondaryAction) && (
        <div className={cn(
          'flex flex-wrap items-center justify-center',
          compact ? 'gap-2 mt-1' : 'gap-3 mt-2'
        )}>
          {action && (
            <Button
              variant={action.variant || 'default'}
              size={compact ? 'sm' : 'default'}
              onClick={action.onClick}
              className="touch-manipulation"
              data-testid={action.testId || 'empty-state-action'}
            >
              {action.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button
              variant={secondaryAction.variant || 'outline'}
              size={compact ? 'sm' : 'default'}
              onClick={secondaryAction.onClick}
              className="touch-manipulation"
              data-testid={secondaryAction.testId || 'empty-state-secondary-action'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </LazyMotionDiv>
  );
}

export function NoFilesEmptyState({
  onCreateFile,
  onCreateFolder,
  className,
}: {
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  className?: string;
}) {
  return (
    <MobileEmptyState
      variant="no-files"
      action={onCreateFile ? {
        label: 'Nouveau fichier',
        onClick: onCreateFile,
        testId: 'empty-state-new-file',
      } : undefined}
      secondaryAction={onCreateFolder ? {
        label: 'Nouveau dossier',
        onClick: onCreateFolder,
        variant: 'outline',
        testId: 'empty-state-new-folder',
      } : undefined}
      className={className}
    />
  );
}

export function NoSearchResultsEmptyState({
  searchQuery,
  onClearSearch,
  className,
}: {
  searchQuery?: string;
  onClearSearch?: () => void;
  className?: string;
}) {
  return (
    <MobileEmptyState
      variant="no-search-results"
      description={searchQuery 
        ? `Aucun fichier ne correspond à "${searchQuery}". Essayez avec d'autres termes.`
        : 'Aucun fichier ne correspond à votre recherche.'
      }
      action={onClearSearch ? {
        label: 'Effacer la recherche',
        onClick: onClearSearch,
        variant: 'outline',
        testId: 'empty-state-clear-search',
      } : undefined}
      className={className}
    />
  );
}

export function EmptyTerminalState({ className }: { className?: string }) {
  return (
    <MobileEmptyState
      variant="empty-terminal"
      compact
      className={className}
    />
  );
}

export function NoProjectEmptyState({
  onCreateProject,
  className,
}: {
  onCreateProject?: () => void;
  className?: string;
}) {
  return (
    <MobileEmptyState
      variant="no-project"
      action={onCreateProject ? {
        label: 'Créer un projet',
        onClick: onCreateProject,
        testId: 'empty-state-create-project',
      } : undefined}
      className={className}
    />
  );
}

export function ErrorEmptyState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <MobileEmptyState
      variant="error"
      description={message}
      action={onRetry ? {
        label: 'Réessayer',
        onClick: onRetry,
        testId: 'empty-state-retry',
      } : undefined}
      className={className}
    />
  );
}
