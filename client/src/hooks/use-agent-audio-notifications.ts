import { useEffect, useRef, useCallback, useState } from 'react';
import { AgentEventBus } from '@/lib/agentEvents';
import { useReducedMotion } from './use-reduced-motion';

const AUDIO_URLS = {
  complete: '/assets/agent-sfx/complete.mp3',
  error: '/assets/agent-sfx/error.mp3',
};

// Feature flag: disable audio until valid assets are available
// The current MP3 files are placeholders (0 bytes) - set to true when real audio is added
const AUDIO_ASSETS_AVAILABLE = false;

interface AudioNotificationSettings {
  enabled: boolean;
  volume: number;
}

const STORAGE_KEY = 'agent-audio-notifications';

function getStoredSettings(): AudioNotificationSettings {
  if (typeof window === 'undefined') {
    return { enabled: false, volume: 0.5 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { enabled: false, volume: 0.5 };
}

function saveSettings(settings: AudioNotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function useAgentAudioNotifications() {
  const prefersReducedMotion = useReducedMotion();
  const audioRef = useRef<{ complete: HTMLAudioElement | null; error: HTMLAudioElement | null }>({
    complete: null,
    error: null,
  });
  
  // Use state for enabled to trigger re-renders when toggled
  const [isEnabled, setIsEnabledState] = useState(() => getStoredSettings().enabled);
  const volumeRef = useRef(getStoredSettings().volume);

  // Lazy-load audio on first play to avoid 416 errors from empty/invalid files
  const audioLoadedRef = useRef<{ complete: boolean; error: boolean }>({
    complete: false,
    error: false,
  });

  const getOrCreateAudio = useCallback((type: 'complete' | 'error'): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    
    // Return cached audio if already loaded
    if (audioRef.current[type] && audioLoadedRef.current[type]) {
      return audioRef.current[type];
    }

    // Create on demand with no preload to avoid range request errors
    try {
      const audio = new Audio();
      audio.volume = volumeRef.current;
      audio.preload = 'none'; // Don't preload to avoid 416 errors
      
      // Handle errors gracefully
      audio.addEventListener('error', () => {
        console.debug('[Audio] Failed to load:', AUDIO_URLS[type]);
        audioLoadedRef.current[type] = false;
      });
      
      audio.addEventListener('canplaythrough', () => {
        audioLoadedRef.current[type] = true;
      });
      
      audio.src = AUDIO_URLS[type];
      audioRef.current[type] = audio;
      return audio;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      // Full cleanup on unmount
      if (audioRef.current.complete) {
        audioRef.current.complete.pause();
        audioRef.current.complete.src = '';
        audioRef.current.complete = null;
      }
      if (audioRef.current.error) {
        audioRef.current.error.pause();
        audioRef.current.error.src = '';
        audioRef.current.error = null;
      }
    };
  }, []);

  const playSound = useCallback((type: 'complete' | 'error') => {
    // Skip if audio assets are not available (placeholder files)
    if (!AUDIO_ASSETS_AVAILABLE) return;
    if (prefersReducedMotion) return;
    if (!isEnabled) return;

    const audio = getOrCreateAudio(type);
    if (audio) {
      audio.currentTime = 0;
      audio.volume = volumeRef.current;
      audio.play().catch(() => {
        // Ignore autoplay errors (user hasn't interacted yet)
      });
    }
  }, [prefersReducedMotion, isEnabled, getOrCreateAudio]);

  useEffect(() => {
    const unsubComplete = AgentEventBus.on('agent:complete', () => {
      playSound('complete');
    });

    const unsubError = AgentEventBus.on('agent:error', () => {
      playSound('error');
    });

    return () => {
      unsubComplete();
      unsubError();
    };
  }, [playSound]);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    saveSettings({ enabled, volume: volumeRef.current });
  }, []);

  const setVolume = useCallback((volume: number) => {
    volumeRef.current = Math.max(0, Math.min(1, volume));
    saveSettings({ enabled: isEnabled, volume: volumeRef.current });
    if (audioRef.current.complete) {
      audioRef.current.complete.volume = volumeRef.current;
    }
    if (audioRef.current.error) {
      audioRef.current.error.volume = volumeRef.current;
    }
  }, [isEnabled]);

  const getVolume = useCallback(() => volumeRef.current, []);

  return {
    isEnabled,
    setEnabled,
    setVolume,
    getVolume,
    playSound,
  };
}
