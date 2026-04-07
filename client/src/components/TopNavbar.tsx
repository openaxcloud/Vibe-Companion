import { useMemo, useState } from "react";
import { Project, File } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import {
  Play,
  Square,
  MoreVertical,
  ChevronDown,
  Globe,
  Terminal,
  Search,
  Bell,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { WorkspaceSettings } from "@/components/WorkspaceSettings";

interface TopNavbarProps {
  project: Project | undefined;
  activeFile: File | undefined;
  isLoading: boolean;
  onNixConfigOpen?: () => void;
  onCommandPaletteOpen?: () => void;
  onKeyboardShortcutsOpen?: () => void;
  onDatabaseOpen?: () => void;
  onCollaborationOpen?: () => void;
  onToggleFiles?: () => void;
  onTogglePreview?: () => void;
  onToggleConsole?: () => void;
  filesOpen?: boolean;
  previewOpen?: boolean;
  consoleOpen?: boolean;
  onSidebarMenuToggle?: () => void;
}

const TopNavbar = ({
  project,
  activeFile,
  isLoading,
  onNixConfigOpen,
  onCommandPaletteOpen,
  onKeyboardShortcutsOpen,
  onDatabaseOpen,
  onCollaborationOpen,
  onToggleFiles,
  onTogglePreview,
  onToggleConsole,
  filesOpen = true,
  previewOpen = true,
  consoleOpen = true,
  onSidebarMenuToggle
}: TopNavbarProps) => {
  const { user, logoutMutation } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    window.dispatchEvent(new CustomEvent("run-project"));
    setTimeout(() => {
      setIsRunning(false);
    }, 2000);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const projectTitle = isLoading ? "Loading..." : project?.name || "Untitled Project";

  return (
    <div className="h-9 border-b border-border bg-background flex items-center justify-between px-2">
      {/* Left Section - Just Project Name */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-foreground" aria-label={`Project: ${projectTitle}`}>
          {projectTitle}
        </span>
      </div>

      {/* Center Section - Empty */}
      <div className="flex-1" />

      {/* Right Section - Actions */}
      <div className="flex items-center gap-1">
        {/* Run Button */}
        {isRunning ? (
          <Button
            size="sm"
            onClick={handleStop}
            className="h-7 px-3 bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium rounded"
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleRun}
            className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium rounded"
          >
            <Play className="h-3 w-3 mr-1" />
            Run
          </Button>
        )}

        {/* Invite Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-[11px] font-medium rounded border-border"
        >
          Invite
        </Button>

        {/* Share Button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-[11px] font-medium rounded border-border"
        >
          Share
        </Button>

        {/* Three Dots Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onCommandPaletteOpen}>
              Command Palette
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onKeyboardShortcutsOpen}>
              Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDatabaseOpen}>
              Database
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onNixConfigOpen}>
              Packages
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Publishing
            </DropdownMenuItem>
            <DropdownMenuItem>
              Git
            </DropdownMenuItem>
            <DropdownMenuItem>
              Secrets
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowSettings(true)}>
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-border">
            <DialogTitle className="text-base">User Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <WorkspaceSettings />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopNavbar;