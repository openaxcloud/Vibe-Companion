import { useLocation } from 'wouter';
import { Home, ChevronLeft, ChevronRight, Menu, SquareStack } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [location, navigate] = useLocation();

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const goHome = () => {
    navigate('/projects');
  };

  return (
    <>
      {/* Ligne noire en bas de l'écran, exactement comme sur Replit */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-black md:hidden z-50"></div>
      
      {/* Navigation mobile principale */}
      <div className="fixed bottom-[1px] left-0 right-0 bg-green-400 border-t h-14 flex items-center justify-between px-6 md:hidden z-40">
        <div className="flex items-center justify-center flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-none"
            onClick={goBack}
            aria-label="Retour"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex items-center justify-center flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-none"
            onClick={goForward}
            aria-label="Avancer"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex items-center justify-center flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-none"
            onClick={goHome}
            aria-label="Accueil"
          >
            <Home className="h-6 w-6" />
          </Button>
        </div>
        
        <div className="flex items-center justify-center flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-none relative"
            onClick={() => navigate('/projects')}
            aria-label="Projets"
          >
            <SquareStack className="h-6 w-6" />
            {/* Badge de notification, comme sur les captures d'écran */}
            <span className="absolute top-2 right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>
    </>
  );
}