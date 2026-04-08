/**
 * Status Bar Component
 * Shows connection status, performance metrics, and system information
 */

import React, { useState, useEffect } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';

// ============================================================================
// TYPES
// ============================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface StatusBarProps {
  connectionStatus?: ConnectionStatus;
  branch?: string;
  language?: string;
  cursorPosition?: { line: number; column: number };
  encoding?: string;
  lineEnding?: 'LF' | 'CRLF';
  indentation?: string;
  showPerformance?: boolean;
  customItems?: React.ReactNode;
}

// ============================================================================
// STATUS BAR COMPONENT
// ============================================================================

export const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus = 'connected',
  branch,
  language,
  cursorPosition,
  encoding = 'UTF-8',
  lineEnding = 'LF',
  indentation = 'Spaces: 2',
  showPerformance = true,
  customItems,
}) => {
  const ds = useDesignSystem();
  const [fps, setFps] = useState(60);
  const [memory, setMemory] = useState(0);

  // Monitor performance
  useEffect(() => {
    if (!showPerformance) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (currentTime - lastTime)));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    // Monitor memory (if available)
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const memoryInterval = setInterval(() => {
      if (perf.memory) {
        setMemory(Math.round(perf.memory.usedJSHeapSize / 1048576));
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(memoryInterval);
    };
  }, [showPerformance]);

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return ds.colors.feedback.success;
      case 'disconnected':
        return ds.colors.feedback.error;
      case 'connecting':
        return ds.colors.feedback.warning;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
    }
  };

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${ds.spacing[2]} ${ds.spacing[4]}`,
        backgroundColor: ds.colors.background.secondary,
        borderTop: `1px solid ${ds.colors.separator.nonOpaque}`,
        fontSize: ds.typography.textStyles.caption1.fontSize,
        color: ds.colors.text.secondary,
        gap: ds.spacing[4],
        flexWrap: 'wrap',
        minHeight: '28px',
      }}
    >
      {/* Left Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ds.spacing[4],
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Connection Status */}
        <StatusItem>
          <LazyMotionDiv
            animate={{
              scale: connectionStatus === 'connecting' ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 1,
              repeat: connectionStatus === 'connecting' ? Infinity : 0,
            }}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getConnectionColor(),
              marginRight: ds.spacing[2],
            }}
          />
          {getConnectionText()}
        </StatusItem>

        {/* Git Branch */}
        {branch && (
          <StatusItem icon="🌿">
            {branch}
          </StatusItem>
        )}

        {/* Custom Items */}
        {customItems}
      </div>

      {/* Right Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ds.spacing[4],
        }}
      >
        {/* Performance Metrics */}
        {showPerformance && (
          <>
            <StatusItem icon="⚡" tooltip="Frames Per Second">
              {fps} FPS
            </StatusItem>
            {memory > 0 && (
              <StatusItem icon="💾" tooltip="Memory Usage">
                {memory} MB
              </StatusItem>
            )}
          </>
        )}

        {/* Cursor Position */}
        {cursorPosition && (
          <StatusItem icon="📍">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </StatusItem>
        )}

        {/* Language */}
        {language && (
          <StatusItem clickable>
            {language}
          </StatusItem>
        )}

        {/* Line Ending */}
        <StatusItem clickable tooltip="Line Ending">
          {lineEnding}
        </StatusItem>

        {/* Encoding */}
        <StatusItem clickable tooltip="File Encoding">
          {encoding}
        </StatusItem>

        {/* Indentation */}
        <StatusItem clickable tooltip="Indentation">
          {indentation}
        </StatusItem>
      </div>
    </LazyMotionDiv>
  );
};

// ============================================================================
// STATUS ITEM
// ============================================================================

interface StatusItemProps {
  children: React.ReactNode;
  icon?: string;
  clickable?: boolean;
  tooltip?: string;
  onClick?: () => void;
}

const StatusItem: React.FC<StatusItemProps> = ({
  children,
  icon,
  clickable,
  tooltip,
  onClick,
}) => {
  const ds = useDesignSystem();
  const [showTooltip, setShowTooltip] = useState(false);

  const Component = clickable || onClick ? LazyMotionButton : 'div';

  return (
    <div style={{ position: 'relative' }}>
      <Component
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
        {...(clickable && {
          whileHover: { backgroundColor: ds.colors.fill.tertiary },
          whileTap: { scale: 0.95 },
        })}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ds.spacing[2],
          padding: clickable ? `${ds.spacing[1]} ${ds.spacing[2]}` : 0,
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: ds.borderRadius.sm,
          color: ds.colors.text.secondary,
          cursor: clickable ? 'pointer' : 'default',
          fontSize: ds.typography.textStyles.caption1.fontSize,
          transition: 'background-color 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {icon && <span>{icon}</span>}
        {children}
      </Component>

      {/* Tooltip */}
      <LazyAnimatePresence>
        {tooltip && showTooltip && (
          <LazyMotionDiv
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: ds.spacing[2],
              padding: `${ds.spacing[2]} ${ds.spacing[3]}`,
              backgroundColor: ds.colors.background.elevated,
              borderRadius: ds.borderRadius.md,
              boxShadow: ds.shadows.lg,
              fontSize: ds.typography.textStyles.caption2.fontSize,
              color: ds.colors.text.primary,
              whiteSpace: 'nowrap',
              zIndex: ds.zIndex.tooltip,
              pointerEvents: 'none',
            }}
          >
            {tooltip}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: `4px solid ${ds.colors.background.elevated}`,
              }}
            />
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </div>
  );
};

// ============================================================================
// NETWORK INDICATOR
// ============================================================================

export const NetworkIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Measure latency
    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch('/api/ping', { method: 'HEAD' });
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    const interval = setInterval(measureLatency, 5000);
    measureLatency();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const ds = useDesignSystem();

  return (
    <StatusItem
      icon={isOnline ? '🌐' : '🔴'}
      tooltip={isOnline ? `Latency: ${latency}ms` : 'Offline'}
    >
      {isOnline ? (latency ? `${latency}ms` : 'Online') : 'Offline'}
    </StatusItem>
  );
};

// ============================================================================
// BATTERY INDICATOR (Mobile)
// ============================================================================

export const BatteryIndicator: React.FC = () => {
  const [battery, setBattery] = useState<{
    level: number;
    charging: boolean;
  } | null>(null);

  useEffect(() => {
    const getBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          const batteryManager = await (navigator as any).getBattery();

          const updateBattery = () => {
            setBattery({
              level: Math.round(batteryManager.level * 100),
              charging: batteryManager.charging,
            });
          };

          updateBattery();

          batteryManager.addEventListener('levelchange', updateBattery);
          batteryManager.addEventListener('chargingchange', updateBattery);

          return () => {
            batteryManager.removeEventListener('levelchange', updateBattery);
            batteryManager.removeEventListener('chargingchange', updateBattery);
          };
        } catch {
          // Battery API not available
        }
      }
    };

    getBattery();
  }, []);

  const ds = useDesignSystem();

  if (!battery) return null;

  const getIcon = () => {
    if (battery.charging) return '🔌';
    if (battery.level > 80) return '🔋';
    if (battery.level > 50) return '🔋';
    if (battery.level > 20) return '🪫';
    return '🪫';
  };

  return (
    <StatusItem icon={getIcon()} tooltip="Battery Level">
      {battery.level}%
    </StatusItem>
  );
};

export default StatusBar;
