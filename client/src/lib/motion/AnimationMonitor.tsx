/**
 * AnimationMonitor - Fortune 500-Grade Performance Monitoring
 * 
 * Tracks animation frame drops and reports performance issues.
 * Automatically degrades to CSS animations when performance is poor.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AnimationMetrics {
  frameDrops: number;
  averageFPS: number;
  jankScore: number;
  lastMeasurement: number;
  isPerformanceGood: boolean;
}

interface AnimationMonitorContextType {
  metrics: AnimationMetrics;
  shouldUseCSS: boolean;
  reportFrameDrop: () => void;
}

const defaultMetrics: AnimationMetrics = {
  frameDrops: 0,
  averageFPS: 60,
  jankScore: 0,
  lastMeasurement: Date.now(),
  isPerformanceGood: true
};

const AnimationMonitorContext = createContext<AnimationMonitorContextType>({
  metrics: defaultMetrics,
  shouldUseCSS: true,
  reportFrameDrop: () => {}
});

export function useAnimationPerformance() {
  return useContext(AnimationMonitorContext);
}

interface AnimationMonitorProps {
  children: ReactNode;
  frameDropThreshold?: number;
  measurementInterval?: number;
}

export function AnimationMonitor({ 
  children, 
  frameDropThreshold = 10,
  measurementInterval = 5000 
}: AnimationMonitorProps) {
  const [metrics, setMetrics] = useState<AnimationMetrics>(defaultMetrics);
  const [shouldUseCSS, setShouldUseCSS] = useState(true);
  const [hasLoggedCSSSwitch, setHasLoggedCSSSwitch] = useState(false);

  const reportFrameDrop = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      frameDrops: prev.frameDrops + 1
    }));
  }, []);

  useEffect(() => {
    let frameCount = 0;
    let lastFrameTime = performance.now();
    let animationId: number;
    let droppedFrames = 0;

    const measureFrame = (currentTime: number) => {
      const delta = currentTime - lastFrameTime;
      frameCount++;

      if (delta > 32) {
        droppedFrames++;
      }

      lastFrameTime = currentTime;
      animationId = requestAnimationFrame(measureFrame);
    };

    animationId = requestAnimationFrame(measureFrame);

    const interval = setInterval(() => {
      const fps = (frameCount * 1000) / measurementInterval;
      const jankScore = (droppedFrames / frameCount) * 100;
      const isPerformanceGood = fps >= 55 && jankScore < 5;

      setMetrics({
        frameDrops: droppedFrames,
        averageFPS: Math.round(fps),
        jankScore: Math.round(jankScore * 10) / 10,
        lastMeasurement: Date.now(),
        isPerformanceGood
      });

      if (droppedFrames > frameDropThreshold && !shouldUseCSS) {
        setShouldUseCSS(true);
        if (!hasLoggedCSSSwitch && process.env.NODE_ENV === 'development') {
          setHasLoggedCSSSwitch(true);
          console.debug('[AnimationMonitor] Optimizing: using CSS animations for better performance');
        }
      }

      frameCount = 0;
      droppedFrames = 0;
    }, measurementInterval);

    return () => {
      cancelAnimationFrame(animationId);
      clearInterval(interval);
    };
  }, [frameDropThreshold, measurementInterval, shouldUseCSS, hasLoggedCSSSwitch]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'longtask' && entry.duration > 50) {
              reportFrameDrop();
              console.debug('[AnimationMonitor] Long task detected:', entry.duration.toFixed(2), 'ms');
            }
          }
        });

        observer.observe({ entryTypes: ['longtask'] });
        return () => observer.disconnect();
      } catch {
      }
    }
  }, [reportFrameDrop]);

  return (
    <AnimationMonitorContext.Provider value={{ metrics, shouldUseCSS, reportFrameDrop }}>
      {children}
    </AnimationMonitorContext.Provider>
  );
}

export function AnimationDebugPanel() {
  const { metrics, shouldUseCSS } = useAnimationPerformance();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-black/80 text-white text-[11px] p-2 rounded-lg font-mono z-50">
      <div>FPS: {metrics.averageFPS}</div>
      <div>Drops: {metrics.frameDrops}</div>
      <div>Jank: {metrics.jankScore}%</div>
      <div className={shouldUseCSS ? 'text-yellow-400' : 'text-green-400'}>
        {shouldUseCSS ? 'CSS Mode' : 'Motion Mode'}
      </div>
    </div>
  );
}
