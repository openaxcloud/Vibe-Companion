import { useState } from 'react';
import { useLocation } from 'wouter';
import { Search, Bell, HelpCircle, User, Menu, X, Bookmark, Share2, MoreVertical } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function MobileHeader() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    if (isSearchOpen) setIsSearchOpen(false);
  };
  
  const toggleSearch = () => {
    setIsSearchOpen(!isSearchOpen);
    if (isMenuOpen) setIsMenuOpen(false);
  };
  
  // Page principale (comme dans IMG_7404.png et IMG_7405.png)
  const renderHomeHeader = () => (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 h-9 w-9"
          onClick={() => navigate('/projects')}
        >
          <div className="h-6 w-6 bg-primary rounded-sm"></div>
        </Button>
        
        <div className="bg-muted rounded-md flex items-center px-2 py-1 w-[70vw]">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-[13px] text-muted-foreground">Search & run commands</span>
        </div>
      </div>
      
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[44px] min-w-[44px]">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[44px] min-w-[44px]">
          <HelpCircle className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 min-h-[44px] min-w-[44px] relative">
          {user?.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user.username} 
              className="h-6 w-6 rounded-full"
            />
          ) : (
            <User className="h-4 w-4" />
          )}
          <span className="absolute -top-1 -right-1 bg-primary text-white text-[11px] rounded-full h-4 w-4 flex items-center justify-center">
            {user?.username ? user.username.slice(0, 2).toUpperCase() : user?.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
          </span>
        </Button>
      </div>
    </div>
  );
  
  // Page de navigation (comme dans IMG_7402.png)
  const renderNavigationHeader = () => (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center">
        <span className="font-medium text-[13px] mx-2">{user?.username || 'User'}</span>
        <Button variant="ghost" size="sm" className="h-6">
          <X className="h-4 w-4 mr-1" />
        </Button>
      </div>
      
      <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Bookmark className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Share2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
  
  // Détermine quel en-tête afficher en fonction de la route
  const getHeaderContent = () => {
    if (location.startsWith('/projects') || location === '/home') {
      return renderHomeHeader();
    } else {
      return renderNavigationHeader();
    }
  };
  
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-50 md:hidden">
      <div className="px-3 h-full flex items-center">
        {getHeaderContent()}
      </div>
      
      {/* Menu de navigation latéral */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-background z-50" onClick={() => setIsMenuOpen(false)}>
          <div 
            className="w-4/5 h-full bg-background overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-surface-tertiary-solid flex items-center justify-center text-primary mr-2">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="font-medium">{user?.username || 'User'}</div>
                  <div className="text-[11px] text-muted-foreground">{user?.email || 'user@example.com'}</div>
                </div>
              </div>
            </div>
            
            <nav className="p-2">
              <ul>
                <li>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-10 font-normal"
                    onClick={() => {
                      navigate('/projects');
                      setIsMenuOpen(false);
                    }}
                  >
                    <Menu className="h-4 w-4 mr-3" />
                    Create App
                  </Button>
                </li>
                <li>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left h-10 font-normal"
                    onClick={() => {
                      navigate('/home');
                      setIsMenuOpen(false);
                    }}
                  >
                    <Menu className="h-4 w-4 mr-3" />
                    Home
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}