import { useState } from 'react';
import { 
  Star, GitBranch, Download, Eye, Code2, ExternalLink, 
  MoreVertical, Heart, Share2, Flag, Copy, Check,
  Clock, Users, TrendingUp, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LazyMotionDiv } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TemplateCardProps {
  template: any;
  viewMode: 'grid' | 'list';
  onClick: () => void;
  onDeploy: () => void;
  onFork: () => void;
}

export function TemplateCard({
  template,
  viewMode,
  onClick,
  onDeploy,
  onFork,
}: TemplateCardProps) {
  const { toast } = useToast();
  const [isFavorite, setIsFavorite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/templates/${template.slug || template.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Link Copied',
      description: 'Template link has been copied to clipboard',
    });
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: template.name,
          text: template.description,
          url: `${window.location.origin}/templates/${template.slug || template.id}`,
        });
      } catch (err) {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleReport = () => {
    toast({
      title: 'Template Reported',
      description: 'Thank you for your feedback. We\'ll review this template.',
    });
  };

  if (viewMode === 'list') {
    return (
      <LazyMotionDiv
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        data-testid={`template-card-${template.id}`}
      >
        <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden">
          <div className="flex">
            {/* Thumbnail */}
            <div className="w-64 h-48 relative bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10">
              {template.thumbnail && !imageError ? (
                <img
                  src={template.thumbnail}
                  alt={template.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Code2 className="h-12 w-12 text-orange-500/50" />
                </div>
              )}
              {template.featured && (
                <Badge className="absolute top-2 left-2 bg-orange-500">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Featured
                </Badge>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-[15px] mb-1" onClick={onClick}>
                    {template.name}
                  </h3>
                  <p className="text-[13px] text-muted-foreground line-clamp-2 mb-3">
                    {template.description}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleShare}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink}>
                      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsFavorite(!isFavorite)}>
                      <Heart className={cn("h-4 w-4 mr-2", isFavorite && "fill-current text-red-500")} />
                      {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReport} className="text-destructive">
                      <Flag className="h-4 w-4 mr-2" />
                      Report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Author and Stats */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={typeof template.author === 'object' ? template.author?.avatar : undefined} />
                    <AvatarFallback>
                      {(typeof template.author === 'object' ? (template.author?.name ?? 'U') : (template.author || 'U')).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[13px] text-muted-foreground">
                    by {typeof template.author === 'object' ? template.author?.name : (template.author ?? 'Anonymous')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current text-yellow-500" />
                    {template.stats?.rating?.toFixed(1) || '0.0'}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    {template.stats?.forks || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="h-4 w-4" />
                    {template.stats?.downloads || 0}
                  </span>
                </div>
              </div>

              {/* Tags and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{template.category}</Badge>
                  {template.tags?.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags?.length > 3 && (
                    <Badge variant="outline">+{template.tags.length - 3}</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={onFork} data-testid={`fork-button-${template.id}`}>
                    <GitBranch className="h-4 w-4 mr-1" />
                    Fork
                  </Button>
                  <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={onDeploy} data-testid={`deploy-button-${template.id}`}>
                    Deploy
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </LazyMotionDiv>
    );
  }

  // Grid View
  return (
    <LazyMotionDiv
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      data-testid={`template-card-${template.id}`}
    >
      <Card className="h-full hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group">
        {/* Thumbnail */}
        <div
          className="relative h-48 bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900/20 dark:to-orange-800/10 overflow-hidden"
          onClick={onClick}
        >
          {template.thumbnail && !imageError ? (
            <>
              <img
                src={template.thumbnail}
                alt={template.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onClick(); }} data-testid={`preview-button-${template.id}`}>
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </Button>
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={(e) => { e.stopPropagation(); onDeploy(); }} data-testid={`deploy-now-button-${template.id}`}>
                  Deploy Now
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Code2 className="h-12 w-12 text-orange-500/50" />
            </div>
          )}
          {template.featured && (
            <Badge className="absolute top-2 left-2 bg-orange-500" data-testid={`featured-badge-${template.id}`}>
              <Sparkles className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
          {template.trending && (
            <Badge className="absolute top-2 right-2 bg-green-500">
              <TrendingUp className="h-3 w-3 mr-1" />
              Trending
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          {/* Title and Description */}
          <div className="mb-3">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold line-clamp-1" title={template.name}>
                {template.name}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 -mt-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFavorite(!isFavorite);
                }}
              >
                <Heart className={cn("h-4 w-4", isFavorite && "fill-current text-red-500")} />
              </Button>
            </div>
            <p className="text-[13px] text-muted-foreground line-clamp-2" title={template.description}>
              {template.description}
            </p>
          </div>

          {/* Author */}
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-5 w-5">
              <AvatarImage src={typeof template.author === 'object' ? template.author?.avatar : undefined} />
              <AvatarFallback>
                {(typeof template.author === 'object' ? (template.author?.name ?? 'U') : (template.author || 'U')).charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-[11px] text-muted-foreground">
              {typeof template.author === 'object' ? template.author?.name : (template.author ?? 'Anonymous')}
            </span>
            {template.author?.verified && (
              <Badge variant="secondary" className="h-4 text-[11px] px-1">
                Verified
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-yellow-500" />
                    {template.stats?.rating?.toFixed(1) || '0.0'}
                  </TooltipTrigger>
                  <TooltipContent>
                    {template.stats?.reviewCount || 0} reviews
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {template.stats?.forks || 0}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {template.stats?.downloads || 0}
              </span>
            </div>
            {template.updatedAt && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : ''}
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="flex gap-1 flex-wrap mb-3">
            <Badge variant="secondary" className="text-[11px]">
              {template.category}
            </Badge>
            {template.tags?.slice(0, 2).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[11px]">
                {tag}
              </Badge>
            ))}
            {template.tags?.length > 2 && (
              <Badge variant="outline" className="text-[11px]">
                +{template.tags.length - 2}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onFork(); }} data-testid={`fork-button-${template.id}`}>
              <GitBranch className="h-3 w-3 mr-1" />
              Fork
            </Button>
            <Button size="sm" className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={(e) => { e.stopPropagation(); onDeploy(); }} data-testid={`deploy-button-${template.id}`}>
              Deploy
            </Button>
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );
}