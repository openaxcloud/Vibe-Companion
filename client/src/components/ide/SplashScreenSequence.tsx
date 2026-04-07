import { useState, useEffect } from 'react';
import {
  Sparkles,
  Globe,
  Database,
  Puzzle,
  MessageSquare,
  Cloud,
  Pencil,
  UserPlus,
  History,
  Settings,
  ExternalLink,
  Shield,
  Smartphone,
  Trees,
  Zap,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SlideLayout = 'icon-hero' | 'two-column' | 'tips-carousel' | 'stat-highlight' | 'icon-grid';

interface SplashSlide {
  layout: SlideLayout;
  icon?: LucideIcon;
  headline: string;
  subtitle: string;
  color: string;
  stats?: { label: string; value: string }[];
  gridItems?: { icon: LucideIcon; label: string }[];
}

const tips = [
  { icon: MessageSquare, text: "Use Plan Mode to chat without code changes" },
  { icon: Cloud, text: "Use App Storage for images/videos" },
  { icon: Pencil, text: "Use Edit Mode to change individual elements" },
  { icon: UserPlus, text: "Invite collaborators in real-time" },
  { icon: History, text: "Use Rollbacks to undo changes" },
  { icon: Settings, text: "Turn on Dynamic Intelligence for more power" },
  { icon: ExternalLink, text: "Send message while Agent is working to add to queue" },
  { icon: Sparkles, text: "Generate images with AI, automatically" },
  { icon: Shield, text: "Agent checks its work with App Testing" },
  { icon: Globe, text: "Custom domains for professional apps" },
  { icon: Database, text: "Built-in database (just ask Agent!)" },
  { icon: Smartphone, text: "Develop on the go with the mobile app" },
  { icon: Trees, text: "Press 'Publish' to put your app online" },
];

const slides: SplashSlide[] = [
  {
    layout: 'icon-hero',
    icon: Sparkles,
    headline: 'Building your app with AI',
    subtitle: 'Our agent writes, tests, and deploys code — all from a single prompt.',
    color: '#8B7EC8',
  },
  {
    layout: 'two-column',
    icon: Zap,
    headline: 'Lightning-fast previews',
    subtitle: 'See changes instantly with hot-reloading and live preview.',
    color: '#E8A838',
    stats: [
      { label: 'Hot reload', value: '<1s' },
      { label: 'Deploy', value: '~30s' },
    ],
  },
  {
    layout: 'tips-carousel',
    icon: Lightbulb,
    headline: 'Tips & tricks',
    subtitle: 'Get the most out of the platform with these shortcuts.',
    color: '#56B6A2',
  },
  {
    layout: 'icon-grid',
    icon: Puzzle,
    headline: 'Seamless integrations',
    subtitle: 'Connect your favorite tools in a few clicks.',
    color: '#E06C75',
    gridItems: [
      { icon: Database, label: 'PostgreSQL' },
      { icon: Shield, label: 'Auth' },
      { icon: Globe, label: 'Domains' },
      { icon: Cloud, label: 'Storage' },
    ],
  },
  {
    layout: 'stat-highlight',
    icon: Globe,
    headline: 'One-click publishing',
    subtitle: 'Deploy to a custom domain and share your app with the world.',
    color: '#4EAADB',
    stats: [
      { label: 'Uptime', value: '99.9%' },
      { label: 'Regions', value: 'Global' },
      { label: 'SSL', value: 'Free' },
    ],
  },
];

const TOTAL_SLIDES = slides.length;

interface SplashScreenSequenceProps {
  isComplete?: boolean;
  onComplete?: () => void;
  appName?: string;
  currentTask?: string;
  progress?: number;
}

function DotIndicator({ total, active, onDotClick }: { total: number; active: number; onDotClick: (i: number) => void }) {
  return (
    <div className="flex items-center gap-2" data-testid="splash-dot-indicator">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onDotClick(i)}
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300 cursor-pointer",
            i === active
              ? "bg-primary scale-125"
              : i < active
                ? "bg-gray-400 dark:bg-zinc-500"
                : "bg-gray-300 dark:bg-zinc-600 hover:bg-gray-400 dark:hover:bg-zinc-500"
          )}
          data-testid={`splash-dot-${i}`}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

function RotatingTipSlide() {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-sm" data-testid="splash-rotating-tip">
      {[0, 1, 2].map((offset) => {
        const idx = (tipIndex + offset) % tips.length;
        const tip = tips[idx];
        const TipIcon = tip.icon;
        return (
          <div
            key={`${tipIndex}-${offset}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl w-full animate-fade-in",
              offset === 0
                ? "bg-primary/10 dark:bg-primary/20"
                : "bg-gray-100 dark:bg-zinc-800"
            )}
          >
            <TipIcon className={cn(
              "w-5 h-5 flex-shrink-0",
              offset === 0 ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-[13px]",
              offset === 0 ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {tip.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SlideContent({ slide }: { slide: SplashSlide }) {
  const SlideIcon = slide.icon;

  switch (slide.layout) {
    case 'icon-hero':
      return (
        <div className="flex flex-col items-center text-center">
          {SlideIcon && (
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ backgroundColor: `${slide.color}18` }}
            >
              <SlideIcon className="w-10 h-10" style={{ color: slide.color }} />
            </div>
          )}
          <h2 className="text-xl font-bold text-black dark:text-white mb-3">{slide.headline}</h2>
          <p className="text-[14px] text-muted-foreground dark:text-gray-400 max-w-sm leading-relaxed">{slide.subtitle}</p>
        </div>
      );

    case 'two-column':
      return (
        <div className="flex flex-col items-center text-center">
          {SlideIcon && (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mb-5"
              style={{ backgroundColor: `${slide.color}18` }}
            >
              <SlideIcon className="w-8 h-8" style={{ color: slide.color }} />
            </div>
          )}
          <h2 className="text-xl font-bold text-black dark:text-white mb-3">{slide.headline}</h2>
          <p className="text-[14px] text-muted-foreground dark:text-gray-400 max-w-sm leading-relaxed mb-5">{slide.subtitle}</p>
          {slide.stats && (
            <div className="flex gap-8">
              {slide.stats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center">
                  <span className="text-2xl font-bold" style={{ color: slide.color }}>{stat.value}</span>
                  <span className="text-[12px] text-muted-foreground mt-1">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case 'tips-carousel':
      return (
        <div className="flex flex-col items-center text-center">
          {SlideIcon && (
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${slide.color}18` }}
            >
              <SlideIcon className="w-7 h-7" style={{ color: slide.color }} />
            </div>
          )}
          <h2 className="text-lg font-bold text-black dark:text-white mb-2">{slide.headline}</h2>
          <p className="text-[13px] text-muted-foreground dark:text-gray-400 mb-5">{slide.subtitle}</p>
          <RotatingTipSlide />
        </div>
      );

    case 'icon-grid':
      return (
        <div className="flex flex-col items-center text-center">
          <h2 className="text-xl font-bold text-black dark:text-white mb-3">{slide.headline}</h2>
          <p className="text-[14px] text-muted-foreground dark:text-gray-400 max-w-sm leading-relaxed mb-6">{slide.subtitle}</p>
          {slide.gridItems && (
            <div className="grid grid-cols-2 gap-3">
              {slide.gridItems.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-zinc-800"
                  >
                    <ItemIcon className="w-5 h-5" style={{ color: slide.color }} />
                    <span className="text-[13px] font-medium text-foreground">{item.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    case 'stat-highlight':
      return (
        <div className="flex flex-col items-center text-center">
          {SlideIcon && (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: `${slide.color}18` }}
            >
              <SlideIcon className="w-8 h-8" style={{ color: slide.color }} />
            </div>
          )}
          <h2 className="text-xl font-bold text-black dark:text-white mb-3">{slide.headline}</h2>
          <p className="text-[14px] text-muted-foreground dark:text-gray-400 max-w-sm leading-relaxed mb-6">{slide.subtitle}</p>
          {slide.stats && (
            <div className="flex gap-6">
              {slide.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800"
                >
                  <span className="text-lg font-bold" style={{ color: slide.color }}>{stat.value}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
  }
}

export function SplashScreenSequence({
  isComplete = false,
  onComplete,
  appName,
  currentTask,
  progress,
}: SplashScreenSequenceProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [sequenceFinished, setSequenceFinished] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    if (!isExiting && (isComplete || sequenceFinished)) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        onComplete?.();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isComplete, sequenceFinished, isExiting, onComplete]);

  useEffect(() => {
    if (isExiting || sequenceFinished) return;
    const interval = setInterval(() => {
      setSlideDirection('forward');
      setActiveSlide((prev) => {
        const next = prev + 1;
        if (next >= TOTAL_SLIDES) {
          setSequenceFinished(true);
          return prev;
        }
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [isExiting, sequenceFinished]);

  const handleDotClick = (index: number) => {
    if (index === activeSlide) return;
    setSlideDirection(index > activeSlide ? 'forward' : 'backward');
    setActiveSlide(index);
  };

  const currentSlide = slides[activeSlide];

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        "bg-white dark:bg-zinc-900 transition-opacity duration-300",
        isExiting ? "opacity-0" : "opacity-100"
      )}
      data-testid="splash-screen-sequence"
    >
      <div className="flex flex-col items-center flex-1 justify-center max-w-lg px-6 w-full">
        <div
          key={activeSlide}
          className={cn(
            slideDirection === 'forward' ? 'splash-slide-in-right' : 'splash-slide-in-left'
          )}
        >
          <SlideContent slide={currentSlide} />
        </div>

        {currentTask && (
          <div className="mt-6 text-[13px] text-muted-foreground dark:text-gray-400 animate-fade-in">
            {currentTask}
          </div>
        )}

        {progress !== undefined && progress > 0 && (
          <div className="w-full max-w-xs mt-4 animate-fade-in">
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-transform duration-500 ease-out origin-left"
                style={{
                  backgroundColor: currentSlide.color,
                  transform: `scaleX(${(progress || 0) / 100})`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground dark:text-gray-500 mt-2 text-center">
              {progress}% complete
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 pb-8">
        <DotIndicator
          total={TOTAL_SLIDES}
          active={activeSlide}
          onDotClick={handleDotClick}
        />

        {appName && (
          <p className="text-[11px] text-muted-foreground/60 dark:text-gray-600 mt-1">
            Building: {appName}
          </p>
        )}
      </div>
    </div>
  );
}

export default SplashScreenSequence;
