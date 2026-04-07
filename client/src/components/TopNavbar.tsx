import { useState } from "react";
import { Project, File } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Settings, Share2, Play, Save, Database, BookMarked, Rocket, Package, Command, Users, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DeploymentManager } from "@/components/DeploymentManager";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopNavbarProps {
  project: Project | undefined;
  activeFile: File | undefined;
  isLoading: boolean;
  onNixConfigOpen?: () => void;
  onCommandPaletteOpen?: () => void;
  onKeyboardShortcutsOpen?: () => void;
  onDatabaseOpen?: () => void;
  onCollaborationOpen?: () => void;
}

const TopNavbar = ({ 
  project, 
  activeFile, 
  isLoading,
  onNixConfigOpen,
  onCommandPaletteOpen,
  onKeyboardShortcutsOpen,
  onDatabaseOpen,
  onCollaborationOpen
}: TopNavbarProps) => {
  const { user, logoutMutation } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isDeploymentOpen, setIsDeploymentOpen] = useState(false);
  
  const handleRun = () => {
    setIsRunning(true);
    
    // Simulate a delay for running
    setTimeout(() => {
      setIsRunning(false);
    }, 2000);
  };
  
  const handleSave = () => {
    // Save functionality would be implemented here
  };
  
  const handleOpenDeployment = () => {
    setIsDeploymentOpen(true);
  };
  
  const handleCloseDeployment = () => {
    setIsDeploymentOpen(false);
  };
  
  return (
    <>
      {project && (
        <DeploymentManager 
          project={project} 
          isOpen={isDeploymentOpen} 
          onClose={handleCloseDeployment} 
        />
      )}
      
      <div className="h-14 border-b flex items-center justify-between px-4">
        {/* Left section - Project/file info */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="font-semibold text-sm">
              {isLoading ? "Loading..." : project?.name || "Untitled Project"}
            </h1>
            <span className="text-xs text-muted-foreground">
              {activeFile?.name || "No file selected"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCommandPaletteOpen}
            className="hidden sm:flex items-center h-8 gap-1 text-xs text-muted-foreground px-2"
          >
            <Command className="h-3.5 w-3.5" />
            <span>Ctrl+K</span>
          </Button>
        </div>
        
        {/* Center section - Actions */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRun}
                  disabled={isRunning}
                >
                  <Play className={`h-4 w-4 ${isRunning ? "text-green-500" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Run</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onDatabaseOpen}
                  disabled={!project}
                >
                  <Database className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Database</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNixConfigOpen}
                  disabled={!project}
                >
                  <Package className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Nix Config</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onKeyboardShortcutsOpen}
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Keyboard Shortcuts</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* Right section - User */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenDeployment}
                  disabled={!project}
                >
                  <Rocket className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Deploy</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCollaborationOpen}
                  disabled={!project}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Share</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                >
                  <Bell className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Notifications</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatarUrl || ""} alt={user?.username || ""} />
                  <AvatarFallback>
                    {user?.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.username}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => logoutMutation.mutate()}
                className="text-red-500"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
};

export default TopNavbar;