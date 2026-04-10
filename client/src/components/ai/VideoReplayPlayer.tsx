/**
 * VideoReplayPlayer - Replit-style Testing Session Video Replay
 * Provides video playback of browser testing sessions with timeline navigation
 * 
 * Identical to Replit's App Testing video replay interface
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, RotateCcw, ChevronDown, Clock,
  CheckCircle2, XCircle, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TestStep {
  id: string;
  timestamp: number;
  type: 'navigation' | 'click' | 'input' | 'assertion' | 'screenshot';
  description: string;
  status: 'passed' | 'failed' | 'pending';
  screenshot?: string;
}

interface VideoReplayPlayerProps {
  videoUrl?: string;
  testSteps: TestStep[];
  duration: number;
  testName: string;
  testStatus: 'passed' | 'failed' | 'running';
  onClose?: () => void;
  className?: string;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function StepIcon({ type, status }: { type: TestStep['type']; status: TestStep['status'] }) {
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === 'pending') return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
  return <CheckCircle2 className="h-4 w-4 text-green-500" />;
}

export function VideoReplayPlayer({
  videoUrl,
  testSteps,
  duration,
  testName,
  testStatus,
  onClose,
  className
}: VideoReplayPlayerProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for testSteps at component level
  const safeTestSteps = testSteps || [];
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeStep, setActiveStep] = useState<string | null>(null);

  // Handle video time update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Find active step based on current time
      const currentStep = safeTestSteps
        .filter(s => s.timestamp <= video.currentTime)
        .pop();
      if (currentStep) {
        setActiveStep(currentStep.id);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [safeTestSteps]);

  // Play/Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Seek to time
  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  // Jump to step
  const jumpToStep = useCallback((step: TestStep) => {
    seekTo(step.timestamp);
    setActiveStep(step.id);
  }, [seekTo]);

  // Skip forward/backward
  const skip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  }, [duration]);

  // Change playback speed
  const changeSpeed = useCallback((speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Restart
  const restart = useCallback(() => {
    seekTo(0);
    setActiveStep(testSteps[0]?.id || null);
  }, [seekTo, testSteps]);

  const statusColors = {
    passed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <div 
      className={cn(
        "flex flex-col bg-black rounded-lg overflow-hidden",
        isFullscreen ? "fixed inset-0 z-50" : "max-h-[600px]",
        className
      )}
      data-testid="video-replay-player"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-medium text-white">{testName}</h3>
          <Badge className={cn("text-[11px]", statusColors[testStatus])}>
            {testStatus === 'passed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
            {testStatus === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
            {testStatus === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {testStatus}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 text-gray-400 hover:text-white"
            >
              ×
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Video Area */}
        <div className="flex-1 relative bg-gray-950 flex items-center justify-center">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              className="max-h-full max-w-full"
              muted={isMuted}
              playsInline
            />
          ) : (
            <div className="text-center text-gray-500 p-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-[13px]">No video recording available</p>
              <p className="text-[11px] mt-1">Screenshots will be shown instead</p>
            </div>
          )}

          {/* Play button overlay when paused */}
          {!isPlaying && videoUrl && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Play className="h-8 w-8 text-white ml-1" />
              </div>
            </button>
          )}
        </div>

        {/* Steps Timeline */}
        <div className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-800">
            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <Clock className="h-3 w-3" />
              <span>Test Steps</span>
              <Badge variant="secondary" className="text-[10px] ml-auto">
                {safeTestSteps.length}
              </Badge>
            </div>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {safeTestSteps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => jumpToStep(step)}
                  className={cn(
                    "w-full text-left p-2 rounded-md transition-colors text-[11px]",
                    activeStep === step.id
                      ? "bg-blue-600/20 border border-blue-500/50"
                      : "hover:bg-gray-800"
                  )}
                  data-testid={`step-${step.id}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5">
                      <StepIcon type={step.type} status={step.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-200 truncate">
                          {index + 1}. {step.type}
                        </span>
                        <span className="text-[10px] text-gray-500 shrink-0">
                          {formatTime(step.timestamp)}
                        </span>
                      </div>
                      <p className="text-gray-400 truncate mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 bg-gray-900 border-t border-gray-800">
        {/* Progress Bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={([value]) => seekTo(value)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              data-testid="button-restart"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skip(-10)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              data-testid="button-skip-back"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={togglePlay}
              className="h-10 w-10 p-0 bg-white/10 hover:bg-white/20 text-white"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => skip(10)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              data-testid="button-skip-forward"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-white"
              data-testid="button-mute"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            {/* Playback Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[11px] text-gray-400 hover:text-white"
                  data-testid="button-speed"
                >
                  {playbackSpeed}x
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[80px]">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <DropdownMenuItem
                    key={speed}
                    onClick={() => changeSpeed(speed)}
                    className={cn(
                      "text-[11px]",
                      playbackSpeed === speed && "bg-accent"
                    )}
                  >
                    {speed}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoReplayPlayer;
