/**
 * PreviewSplashScreen - Replit-identical preview splash screen
 * 
 * Shows "Preview will be available soon" with animated dot logo
 * and rotating tips during app building/loading
 */

import { useState, useEffect } from 'react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  MessageSquare,
  Cloud,
  Pencil,
  UserPlus,
  History,
  Settings,
  ExternalLink,
  Puzzle,
  Sparkles,
  Shield,
  Globe,
  Database,
  Smartphone,
  Trees,
  Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PreviewSplashScreenProps {
  isBuilding?: boolean;
  appName?: string;
  onRunClick?: () => void;
  phase?: 'planning' | 'scaffolding' | 'building' | 'styling' | 'finalizing' | 'complete';
  currentTask?: string;
  progress?: number;
  onComplete?: () => void;
}

const DOT_COLOR = '#8B7EC8';

const tips = [
  { icon: MessageSquare, text: "Use Plan Mode to chat without code changes" },
  { icon: Cloud, text: "Use App Storage for images/videos" },
  { icon: Pencil, text: "Use Edit Mode to change individual elements" },
  { icon: UserPlus, text: "Invite collaborators in real-time" },
  { icon: History, text: "Use Rollbacks to undo changes" },
  { icon: Settings, text: "Turn on Dynamic Intelligence for more power" },
  { icon: ExternalLink, text: "Send message while Agent is working to add to queue" },
  { icon: Puzzle, text: "Seamless integrations with 3rd party tools" },
  { icon: Sparkles, text: "Generate images with AI, automatically" },
  { icon: Shield, text: "Agent checks its work with App Testing" },
  { icon: Globe, text: "Custom domains for professional apps" },
  { icon: Database, text: "Built-in database (just ask Agent!)" },
  { icon: Smartphone, text: "Develop on the go with the mobile app" },
  { icon: Trees, text: "Press 'Publish' to put your app online" },
];

type DotPosition = { x: number; y: number };

const dotPatterns: DotPosition[][] = [
  [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ],
  [
    { x: 1, y: 0 },
    { x: 0.5, y: 0.5 }, { x: 1.5, y: 0.5 },
    { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
  ],
  [
    { x: 0, y: 0.3 }, { x: 0.8, y: 0 }, { x: 1.6, y: 0.3 },
    { x: 0.4, y: 1 }, { x: 1.2, y: 0.7 }, { x: 2, y: 1 },
  ],
  [
    { x: 0.5, y: 0 }, { x: 1.5, y: 0 },
    { x: 0, y: 0.75 }, { x: 1, y: 0.75 }, { x: 2, y: 0.75 },
    { x: 1, y: 1.5 },
  ],
  [
    { x: 0, y: 0 }, { x: 2, y: 0 },
    { x: 1, y: 0.5 },
    { x: 1, y: 1 },
    { x: 0, y: 1.5 }, { x: 2, y: 1.5 },
  ],
];

function AnimatedDotLogo() {
  const [patternIndex, setPatternIndex] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setPatternIndex((prev) => (prev + 1) % dotPatterns.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentPattern = dotPatterns[patternIndex];
  const dotSize = 12;
  const spacing = 20;

  return (
    <div 
      className="relative mb-8"
      style={{ width: 80, height: 60 }}
      data-testid="splash-animated-logo"
    >
      {currentPattern.map((pos, index) => (
        <LazyMotionDiv
          key={index}
          className="absolute rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: DOT_COLOR,
          }}
          initial={false}
          animate={{
            left: pos.x * spacing + 10,
            top: pos.y * spacing + 5,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 25,
            duration: 0.6,
          }}
          data-testid={`splash-dot-${index}`}
        />
      ))}
    </div>
  );
}

function RotatingTip() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const currentTip = tips[tipIndex];
  const Icon = currentTip.icon;

  return (
    <div 
      className="h-8 flex items-center justify-center"
      data-testid="splash-rotating-tip"
    >
      <LazyAnimatePresence mode="wait">
        <LazyMotionDiv
          key={tipIndex}
          className="flex items-center gap-2 text-[13px] text-muted-foreground dark:text-gray-400"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          data-testid={`splash-tip-${tipIndex}`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span>{currentTip.text}</span>
        </LazyMotionDiv>
      </LazyAnimatePresence>
    </div>
  );
}

export function PreviewSplashScreen({ 
  isBuilding = true,
  appName,
  onRunClick,
  phase,
  currentTask,
  progress,
  onComplete,
}: PreviewSplashScreenProps) {
  // Handle phase completion - call onComplete and return null to hide splash
  useEffect(() => {
    if (phase === 'complete' || (!isBuilding && !onRunClick)) {
      // Give a brief moment to show completion, then call onComplete
      const timer = setTimeout(() => {
        onComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [phase, isBuilding, onRunClick, onComplete]);

  // If build is complete and no run button needed, hide the splash
  if (phase === 'complete') {
    return null;
  }

  // If not building and no run click handler, don't show splash
  if (!isBuilding && !onRunClick) {
    return null;
  }

  const showNotRunningState = !isBuilding && onRunClick;

  return (
    <LazyMotionDiv 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        "bg-white dark:bg-zinc-900"
      )}
      data-testid="preview-splash-screen"
    >
      <div className="flex flex-col items-center max-w-md px-6 text-center">
        <AnimatedDotLogo />

        <LazyMotionDiv 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-bold text-black dark:text-white mb-6"
          data-testid="splash-title"
        >
          Preview will be available soon
        </LazyMotionDiv>

        {showNotRunningState ? (
          <LazyMotionDiv
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-4"
          >
            <p className="text-[13px] text-muted-foreground dark:text-gray-400">
              Your app is not running. Click below to start it.
            </p>
            <Button
              onClick={onRunClick}
              className="gap-2"
              data-testid="splash-run-button"
            >
              <Play className="w-4 h-4" />
              Run App
            </Button>
          </LazyMotionDiv>
        ) : (
          <>
            {currentTask && (
              <LazyMotionDiv
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="text-[13px] text-muted-foreground dark:text-gray-400 mb-4"
                data-testid="splash-current-task"
              >
                {currentTask}
              </LazyMotionDiv>
            )}

            {progress !== undefined && progress > 0 && (
              <LazyMotionDiv 
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-xs mb-6"
                data-testid="splash-progress-container"
              >
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-transform duration-500 ease-out origin-left"
                    style={{ backgroundColor: DOT_COLOR, transform: `scaleX(${(progress || 0) / 100})` }}
                    data-testid="splash-progress-bar"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-gray-500 mt-2">
                  {progress}% complete
                </p>
              </LazyMotionDiv>
            )}

            <LazyMotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <RotatingTip />
            </LazyMotionDiv>
          </>
        )}

        {appName && (
          <LazyMotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 text-[11px] text-muted-foreground/60 dark:text-gray-600"
            data-testid="splash-app-name"
          >
            Building: {appName}
          </LazyMotionDiv>
        )}
      </div>
    </LazyMotionDiv>
  );
}

export default PreviewSplashScreen;
