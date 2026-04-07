import { useState } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence, type PanInfo } from '@/lib/motion';
import { 
  X, Plus, Github, Upload, FileCode, Globe, Server, Bot,
  Database, Gamepad2, BookOpen, Briefcase, ShoppingCart,
  MessageSquare, Music, Film, Image as ImageIcon, Sparkles,
  TrendingUp, Code2, Palette, Zap, Rocket, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BuildModeSelector, BuildMode } from '@/components/ai/BuildModeSelector';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  language?: string;
  isPopular?: boolean;
  isNew?: boolean;
}

interface MobileCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate?: (template: Template) => void;
  onImport?: (type: 'github' | 'upload') => void;
}

// Template categories
const templates: Template[] = [
  // Web Development
  { id: 'react', name: 'React App', description: 'Modern React with Vite', icon: Code2, category: 'Web', language: 'JavaScript', isPopular: true },
  { id: 'next', name: 'Next.js', description: 'Full-stack React framework', icon: Globe, category: 'Web', language: 'TypeScript', isNew: true },
  { id: 'vue', name: 'Vue.js', description: 'Progressive web app', icon: Code2, category: 'Web', language: 'JavaScript' },
  { id: 'angular', name: 'Angular', description: 'Enterprise web app', icon: Code2, category: 'Web', language: 'TypeScript' },
  
  // Backend
  { id: 'node', name: 'Node.js API', description: 'RESTful API with Express', icon: Server, category: 'Backend', language: 'JavaScript', isPopular: true },
  { id: 'python', name: 'Python Flask', description: 'Lightweight Python API', icon: Server, category: 'Backend', language: 'Python' },
  { id: 'django', name: 'Django App', description: 'Full-featured Python web', icon: Server, category: 'Backend', language: 'Python' },
  { id: 'fastapi', name: 'FastAPI', description: 'Modern Python API', icon: Zap, category: 'Backend', language: 'Python', isNew: true },
  
  // AI & ML
  { id: 'chatbot', name: 'AI Chatbot', description: 'OpenAI powered chat', icon: Bot, category: 'AI', isPopular: true, isNew: true },
  { id: 'ml-model', name: 'ML Model', description: 'Train and deploy ML', icon: Sparkles, category: 'AI', language: 'Python' },
  { id: 'langchain', name: 'LangChain App', description: 'LLM application', icon: Bot, category: 'AI', language: 'Python', isNew: true },
  
  // Database
  { id: 'postgres', name: 'PostgreSQL', description: 'Relational database', icon: Database, category: 'Database' },
  { id: 'mongodb', name: 'MongoDB', description: 'NoSQL database', icon: Database, category: 'Database' },
  { id: 'redis', name: 'Redis Cache', description: 'In-memory data store', icon: Database, category: 'Database' },
  
  // Games
  { id: 'phaser', name: 'Phaser Game', description: 'HTML5 game engine', icon: Gamepad2, category: 'Games', language: 'JavaScript' },
  { id: 'unity', name: 'Unity WebGL', description: '3D game development', icon: Gamepad2, category: 'Games', language: 'C#' },
  
  // Templates
  { id: 'blog', name: 'Blog', description: 'Personal blog site', icon: BookOpen, category: 'Templates' },
  { id: 'portfolio', name: 'Portfolio', description: 'Developer portfolio', icon: Briefcase, category: 'Templates', isPopular: true },
  { id: 'ecommerce', name: 'E-Commerce', description: 'Online store', icon: ShoppingCart, category: 'Templates' },
  { id: 'landing', name: 'Landing Page', description: 'Product landing', icon: Palette, category: 'Templates' },
];

const categories = ['All', 'Popular', 'Web', 'Backend', 'AI', 'Database', 'Games', 'Templates'];

// Suggested templates (first 4 from catalog)
const recentTemplates = templates.slice(0, 4);

export function MobileCreateModal({
  isOpen,
  onClose,
  onCreate,
  onImport
}: MobileCreateModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentSnapPoint, setCurrentSnapPoint] = useState(1);
  
  // Build mode selector state
  const [isBuildModeOpen, setIsBuildModeOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  
  // Handle drag to close
  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 100;
    const velocity = info.velocity.y;
    
    if (velocity > 500 || info.offset.y > threshold) {
      onClose();
    } else {
      // Snap to nearest point
      const windowHeight = window.innerHeight;
      const currentY = info.offset.y;
      
      if (currentY < windowHeight * 0.25) {
        setCurrentSnapPoint(2); // Full screen
      } else if (currentY < windowHeight * 0.6) {
        setCurrentSnapPoint(1); // Half screen
      } else {
        setCurrentSnapPoint(0); // Minimized
      }
    }
  };
  
  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' ||
                           (selectedCategory === 'Popular' && template.isPopular) ||
                           template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const handleTemplateSelect = (template: Template) => {
    // Show build mode selector before creating the project
    setPendingTemplate(template);
    setIsBuildModeOpen(true);
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };
  
  // Handle build mode selection
  const handleSelectBuildMode = (mode: BuildMode) => {
    // Haptic feedback for mobile
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
    
    if (mode === 'continue-planning') {
      // User wants to continue planning - close build mode dialog but stay in create modal
      setIsBuildModeOpen(false);
      setPendingTemplate(null);
      return;
    }
    
    // Store build mode in sessionStorage for the IDE to pick up
    if (pendingTemplate) {
      // Create a unique key for the new project - will be matched when project is created
      sessionStorage.setItem('pending-build-mode', mode);
      
      // Proceed with template creation
      onCreate?.(pendingTemplate);
      setIsBuildModeOpen(false);
      setPendingTemplate(null);
      onClose();
    }
  };
  
  const snapPoints = [0.2, 0.6, 1];
  const snapHeights = snapPoints.map(point => `${(1 - point) * 100}%`);
  
  return (
    <LazyAnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          
          {/* Bottom Sheet */}
          <LazyMotionDiv
            className="fixed bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl z-50 mobile-safe-bottom"
            initial={{ y: '100%' }}
            animate={{ 
              y: snapHeights[currentSnapPoint]
            }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 500 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            style={{ 
              maxHeight: '90vh',
              touchAction: 'none'
            }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <LazyMotionDiv 
                className="w-12 h-1.5 bg-surface-hover-solid rounded-full"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              />
            </div>
            
            {/* Header */}
            <div className="px-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-semibold">Create New Project</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-11 w-11"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="px-4 pb-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => onImport?.('github')}
                >
                  <Github className="h-4 w-4 mr-2" />
                  Import from GitHub
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => onImport?.('upload')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </div>
            </div>
            
            {/* Category Tabs */}
            <div className="px-4 pb-3">
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-2 pb-1">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={cn(
                        "whitespace-nowrap",
                        selectedCategory === category && "bg-primary hover:bg-primary/90"
                      )}
                    >
                      {category === 'Popular' && '⭐ '}
                      {category}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            
            {/* Content */}
            <ScrollArea className="flex-1 px-4">
              <div className="pb-6">
                {/* Recent Templates */}
                {!searchQuery && selectedCategory === 'All' && (
                  <div className="mb-6">
                    <h3 className="text-[13px] font-medium mb-3 text-muted-foreground">Recent</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {recentTemplates.map((template) => (
                        <LazyMotionButton
                          key={`recent-${template.id}`}
                          className="bg-card border rounded-lg p-3 text-left hover:bg-accent transition-colors"
                          onClick={() => handleTemplateSelect(template)}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="p-2 bg-muted rounded-md">
                              <template.icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[13px] truncate">{template.name}</p>
                              <p className="text-[11px] text-muted-foreground">Used 2 days ago</p>
                            </div>
                          </div>
                        </LazyMotionButton>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Template Grid */}
                <div>
                  <h3 className="text-[13px] font-medium mb-3 text-muted-foreground">
                    {searchQuery ? 'Search Results' : 'Templates'}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredTemplates.map((template) => (
                      <LazyMotionButton
                        key={template.id}
                        className="bg-card border rounded-lg p-3 text-left hover:bg-accent transition-colors relative"
                        onClick={() => handleTemplateSelect(template)}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        {/* Badges */}
                        <div className="absolute top-2 right-2 flex gap-1">
                          {template.isPopular && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-surface-tertiary-solid text-amber-500 rounded-full">
                              Popular
                            </span>
                          )}
                          {template.isNew && (
                            <span className="text-[11px] px-1.5 py-0.5 bg-surface-tertiary-solid text-green-500 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex flex-col gap-2">
                          <div className="p-2 bg-muted rounded-md w-fit">
                            <template.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-[13px]">{template.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {template.description}
                            </p>
                            {template.language && (
                              <p className="text-[11px] text-muted-foreground mt-1">
                                {template.language}
                              </p>
                            )}
                          </div>
                        </div>
                      </LazyMotionButton>
                    ))}
                  </div>
                  
                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-[13px]">No templates found</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Try adjusting your search or filters
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Create Blank */}
                <div className="mt-6">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleTemplateSelect({
                      id: 'blank',
                      name: 'Blank Project',
                      description: 'Start from scratch',
                      icon: FileCode,
                      category: 'Other'
                    })}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Blank Project
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </LazyMotionDiv>
          
          {/* Build Mode Selector Dialog - touch-friendly for mobile */}
          <BuildModeSelector
            open={isBuildModeOpen}
            onOpenChange={setIsBuildModeOpen}
            onSelectMode={handleSelectBuildMode}
            projectName={pendingTemplate?.name || 'New Project'}
          />
        </>
      )}
    </LazyAnimatePresence>
  );
}