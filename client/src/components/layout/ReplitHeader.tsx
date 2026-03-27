// @ts-nocheck
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  Plus,
  Bell,
  Settings,
  LogOut,
  User,
  Zap,
  Crown,
  HelpCircle,
  Book,
  Users,
  Code,
  Database,
  Globe,
  Menu,
  X,
  Lock,
  Terminal,
  Palette,
  Workflow,
  Shield,
  HardDrive,
  Key,
  Package,
  ChevronDown,
  GraduationCap,
  DollarSign,
  Gift,
  BarChart3,
  Trophy,
  Store,
  Rocket,
  CreditCard,
  Share2,
  GitBranch,
  Download,
  Copy,
  FolderOpen,
  History,
  Star,
  MoreHorizontal,
  Bot,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SpotlightSearch } from "@/components/SpotlightSearch";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { ECodeLogo } from "@/components/ECodeLogo";
import { MobileMenu } from "./MobileMenu";
import {
  isActiveNavigationItem,
  primaryNavigation,
  secondaryNavigation,
  type NavigationItem,
} from "@/constants/navigation";

import {
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";

export function ReplitHeader() {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [projectInfoLoading, setProjectInfoLoading] = useState(false);
  const [projectInfoError, setProjectInfoError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const ideMatch = location.match(/^\/ide\/([^/?]+)/);
  const legacyProjectMatch = location.match(/^\/project(?:s)?\/([^/?]+)/);
  const projectId = ideMatch?.[1] || legacyProjectMatch?.[1] || null;

  const replitStyleMatch = location.match(/^\/@([^/]+)\/([^/?]+)/);
  const userStyleMatch = location.match(/^\/u\/([^/]+)\/([^/?]+)/);
  const username = replitStyleMatch?.[1] || userStyleMatch?.[1] || null;
  const projectSlug = replitStyleMatch?.[2] || userStyleMatch?.[2] || null;

  useEffect(() => {
    const fetchProjectInfo = async () => {
      if (projectId) {
        setProjectInfoLoading(true);
        setProjectInfoError(null);
        try {
          const data = await apiRequest('GET', `/api/projects/${projectId}`);
          setProjectInfo(data);
        } catch (error) {
          console.error('Failed to fetch project info:', error);
          setProjectInfoError('Failed to load project');
          setProjectInfo(null);
        } finally {
          setProjectInfoLoading(false);
        }
      } else if (username && projectSlug) {
        setProjectInfoLoading(true);
        setProjectInfoError(null);
        try {
          const data = await apiRequest('GET', `/api/u/${username}/${projectSlug}`);
          setProjectInfo(data);
        } catch (error) {
          console.error('Failed to fetch project info:', error);
          setProjectInfoError('Failed to load project');
          setProjectInfo(null);
        } finally {
          setProjectInfoLoading(false);
        }
      } else {
        setProjectInfo(null);
        setProjectInfoLoading(false);
        setProjectInfoError(null);
      }
    };

    fetchProjectInfo();
  }, [projectId, username, projectSlug]);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navLinkClass = "replit-nav-link";
  const primaryNav: NavigationItem[] = primaryNavigation;
  const moreNav: NavigationItem[] = secondaryNavigation;

  return (
    <>
    <header role="banner" aria-label="Site header" className="replit-header h-14 bg-background dark:bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center px-4 gap-2 replit-transition overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
        <div className="lg:hidden mr-2">
          <MobileMenu onOpenSpotlight={() => setSpotlightOpen(true)} />
        </div>

        <Link href="/" className="flex items-center shrink-0">
          <ECodeLogo size="sm" showText={!isMobile} className="hover:opacity-80 transition-opacity" />
        </Link>

        {projectInfoLoading && (
          <>
            <span className="text-[var(--ecode-text-muted)] mx-2">/</span>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="text-[var(--ecode-text-muted)] font-medium flex items-center gap-1"
            >
              <FolderOpen className="h-4 w-4 animate-pulse" />
              <span className="animate-pulse">Loading...</span>
            </Button>
          </>
        )}
        {projectInfoError && (
          <>
            <span className="text-[var(--ecode-text-muted)] mx-2">/</span>
            <Button
              variant="ghost"
              size="sm"
              disabled
              className="text-[var(--ecode-danger)] font-medium flex items-center gap-1"
              title={projectInfoError}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Error</span>
            </Button>
          </>
        )}
        {projectInfo && !projectInfoLoading && !projectInfoError && (
          <>
            <span className="text-[var(--ecode-text-muted)] mx-2">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)] replit-transition font-medium flex items-center gap-1"
                >
                  <FolderOpen className="h-4 w-4" />
                  {projectInfo.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => {
                    if (projectInfo?.owner?.username && projectInfo?.slug) {
                      navigate(`/@${projectInfo.owner.username}/${projectInfo.slug}`);
                    } else {
                      navigate(`/ide/${projectId}`);
                    }
                  }}
                >
                  <Code className="mr-2 h-4 w-4" />
                  Open project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => navigate(`/projects/${projectId}/settings`)}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => navigate(`/projects/${projectId}/git`)}
                >
                  <GitBranch className="mr-2 h-4 w-4" />
                  Version control
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => navigate(`/projects/${projectId}/database`)}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Database
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => navigate(`/projects/${projectId}/deployments`)}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Deployments
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={async () => {
                    try {
                      const forkedProject = await apiRequest('POST', `/api/projects/${projectId}/fork`);
                      toast({
                        title: "Project Forked",
                        description: `Successfully forked project as "${forkedProject.name}"`,
                      });
                      navigate(`/ide/${forkedProject.id}`);
                    } catch (error) {
                      toast({
                        title: "Fork Failed",
                        description: "Failed to fork project. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Fork project
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => {
                    const shareUrl = window.location.origin + window.location.pathname;
                    navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: "Link Copied",
                      description: "Project link copied to clipboard",
                    });
                  }}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/projects/${projectId}/download`, {
                        credentials: 'include'
                      });
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = `${projectInfo?.name || 'project'}.zip`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        toast({
                          title: "Download Started",
                          description: "Your project is being downloaded",
                        });
                      } else {
                        throw new Error('Download failed');
                      }
                    } catch (error) {
                      toast({
                        title: "Download Failed",
                        description: "Failed to download project. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
                <DropdownMenuItem 
                  className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                  onClick={() => navigate(`/projects/${projectId}/history`)}
                >
                  <History className="mr-2 h-4 w-4" />
                  History
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <nav aria-label="Primary navigation" className="replit-nav">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(navLinkClass, "replit-nav-link--trigger replit-transition")}
              >
                <Plus className="mr-1 h-4 w-4" />
                Create
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
              <DropdownMenuItem className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={() => navigate('/dashboard')}>
                <Zap className="mr-2 h-4 w-4" />
                Build with AI
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={() => navigate('/new')}>
                <Code className="mr-2 h-4 w-4" />
                Start from scratch
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={() => navigate('/templates')}>
                <Package className="mr-2 h-4 w-4" />
                From template
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={() => navigate('/github-import')}>
                <Database className="mr-2 h-4 w-4" />
                Import from GitHub
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />
              <DropdownMenuItem className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]" onClick={() => navigate('/teams/new')}>
                <Users className="mr-2 h-4 w-4" />
                Create a team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = isActiveNavigationItem(location, item);

            return (
              <Link key={item.key} href={item.path} aria-label={item.ctaLabel || item.label}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    navLinkClass,
                    "replit-transition relative",
                    active ? "replit-nav-link--active" : "replit-nav-link--inactive"
                  )}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </Button>
              </Link>
            );
          })}

          {moreNav.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(navLinkClass, "replit-nav-link--inactive replit-transition")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-[var(--ecode-surface)] border-[var(--ecode-border)]">
                {moreNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]"
                      onClick={() => navigate(item.path)}
                    >
                      {Icon && <Icon className="mr-2 h-4 w-4" />}
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>

      {/* Hide search bar in IDE view - the IDE has its own file search */}
      {!projectId && (
        <div className="flex-1 min-w-0 max-w-xs hidden xl:block">
          <Button
            variant="ghost"
            className="replit-header-search"
            onClick={() => setSpotlightOpen(true)}
            aria-label="Search or run a command (⌘K)"
          >
            <Search className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate text-sm">Search or run a command...</span>
            <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 shrink-0">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </Button>
        </div>
      )}

      <div className="replit-header-controls flex items-center gap-2 flex-shrink-0 ml-auto">
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center space-x-1 border-[var(--ecode-warning)] text-[var(--ecode-warning)] hover:bg-surface-hover-solid replit-transition"
          onClick={() => navigate('/pricing')}
        >
          <Crown className="h-4 w-4" />
          <span>Upgrade</span>
        </Button>



        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 replit-hover">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.username || undefined} />
                <AvatarFallback className="bg-[var(--ecode-accent)] text-white">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[var(--ecode-surface)] border-[var(--ecode-border)]" align="end">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium text-[var(--ecode-text)]">{user?.displayName || user?.username}</p>
                <p className="w-[200px] truncate text-[13px] text-[var(--ecode-text-secondary)]">
                  {user?.email}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />

            <DropdownMenuItem 
              onClick={() => navigate(`/@${user?.username}`)}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <User className="mr-2 h-4 w-4" />
              View Profile
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/account')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Settings className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />

            <DropdownMenuItem 
              onClick={() => navigate('/analytics')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/badges')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Trophy className="mr-2 h-4 w-4" />
              Badges & Achievements
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/education')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <GraduationCap className="mr-2 h-4 w-4" />
              Education Center
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/marketplace')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Store className="mr-2 h-4 w-4" />
              Marketplace
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/powerups')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Rocket className="mr-2 h-4 w-4" />
              Power Ups
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />

            <DropdownMenuItem 
              onClick={() => navigate('/cycles')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Zap className="mr-2 h-4 w-4" />
              Cycles
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/plans')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <CreditCard className="mr-2 h-4 w-4" />
              Plans & Pricing
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/deployments')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Globe className="mr-2 h-4 w-4" />
              Deployments
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/bounties')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <DollarSign className="mr-2 h-4 w-4" />
              Bounties
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/teams')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Users className="mr-2 h-4 w-4" />
              Teams & Orgs
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />

            <DropdownMenuItem 
              onClick={() => navigate('/learn')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <GraduationCap className="mr-2 h-4 w-4" />
              Learn
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/docs')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <Book className="mr-2 h-4 w-4" />
              Documentation
            </DropdownMenuItem>

            <DropdownMenuItem 
              onClick={() => navigate('/support')}
              className="text-[var(--ecode-text)] hover:bg-[var(--ecode-sidebar-hover)]">
              <HelpCircle className="mr-2 h-4 w-4" />
              Support
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[var(--ecode-border)]" />

            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-[var(--ecode-danger)] hover:bg-[var(--ecode-sidebar-hover)]">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    <SpotlightSearch open={spotlightOpen} onOpenChange={setSpotlightOpen} />
    </>
  );
}
