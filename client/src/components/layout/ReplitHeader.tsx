import { useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SpotlightSearch } from "@/components/SpotlightSearch";

export function ReplitHeader() {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => location === path;

  return (
    <>
    <header className="h-14 bg-[var(--replit-surface)] border-b border-[var(--replit-border)] flex items-center justify-between px-4 replit-transition">
      {/* Logo et navigation principale */}
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2 replit-hover rounded-lg px-2 py-1">
          <div className="w-8 h-8 bg-[var(--replit-green)] rounded-lg flex items-center justify-center">
            <Code className="h-5 w-5 text-black" />
          </div>
          <span className="font-bold text-lg text-[var(--replit-text)]">PLOT</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          <Link href="/projects">
            <Button
              variant={isActive("/projects") ? "default" : "ghost"}
              size="sm"
              className={`replit-transition ${
                isActive("/projects")
                  ? "bg-[var(--replit-accent)] text-white"
                  : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              }`}
            >
              My Repls
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)] replit-transition"
              >
                Create
                <Plus className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-[var(--replit-surface)] border-[var(--replit-border)]">
              <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Code className="mr-2 h-4 w-4" />
                New Repl
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Database className="mr-2 h-4 w-4" />
                Import from GitHub
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
              <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
                <Users className="mr-2 h-4 w-4" />
                Team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/explore">
            <Button
              variant={isActive("/explore") ? "default" : "ghost"}
              size="sm"
              className={`replit-transition ${
                isActive("/explore")
                  ? "bg-[var(--replit-accent)] text-white"
                  : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              }`}
            >
              Explore
            </Button>
          </Link>

          <Link href="/community">
            <Button
              variant={isActive("/community") ? "default" : "ghost"}
              size="sm"
              className={`replit-transition ${
                isActive("/community")
                  ? "bg-[var(--replit-accent)] text-white"
                  : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              }`}
            >
              Community
            </Button>
          </Link>
          
          <Link href="/teams">
            <Button
              variant={isActive("/teams") ? "default" : "ghost"}
              size="sm"
              className={`replit-transition ${
                isActive("/teams")
                  ? "bg-[var(--replit-accent)] text-white"
                  : "text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]"
              }`}
            >
              Teams
            </Button>
          </Link>
        </nav>
      </div>

      {/* Barre de recherche */}
      <div className="flex-1 max-w-md mx-6 hidden lg:block">
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal bg-[var(--replit-surface-secondary)] border-[var(--replit-border)] text-[var(--replit-text-secondary)] hover:bg-[var(--replit-sidebar-hover)]"
          onClick={() => setSpotlightOpen(true)}
        >
          <Search className="mr-2 h-4 w-4" />
          <span>Search or run a command...</span>
          <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      {/* Actions utilisateur */}
      <div className="flex items-center space-x-3">
        {/* Bouton Plan Pro */}
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center space-x-1 border-[var(--replit-warning)] text-[var(--replit-warning)] hover:bg-[var(--replit-warning)]/10 replit-transition"
        >
          <Crown className="h-4 w-4" />
          <span>Upgrade</span>
        </Button>

        {/* Notifications */}
        <NotificationCenter />

        {/* Menu utilisateur */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 replit-hover">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || ""} alt={user?.username} />
                <AvatarFallback className="bg-[var(--replit-accent)] text-white">
                  {user?.username?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[var(--replit-surface)] border-[var(--replit-border)]" align="end">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium text-[var(--replit-text)]">{user?.displayName || user?.username}</p>
                <p className="w-[200px] truncate text-sm text-[var(--replit-text-secondary)]">
                  {user?.email}
                </p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
            
            <DropdownMenuItem 
              onClick={() => navigate(`/profile/${user?.username}`)}
              className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
              <Zap className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              onClick={() => navigate('/settings')}
              className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
            
            <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
              <Book className="mr-2 h-4 w-4" />
              Documentation
            </DropdownMenuItem>
            
            <DropdownMenuItem className="text-[var(--replit-text)] hover:bg-[var(--replit-sidebar-hover)]">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-[var(--replit-border)]" />
            
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-[var(--replit-danger)] hover:bg-[var(--replit-danger)]/10"
            >
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