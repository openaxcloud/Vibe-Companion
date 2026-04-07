/**
 * PWA Install Prompt Component
 * Handles the beforeinstallprompt event and displays a custom install UI
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone, Monitor } from 'lucide-react';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    // Detect platform
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setPlatform(isMobile ? 'mobile' : 'desktop');

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed the prompt before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed) : 0;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    // Don't show again if dismissed within 7 days
    if (dismissedTime && now - dismissedTime < sevenDays) {
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      // Show prompt after 30 seconds (user has had time to explore)
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    } else {
      handleDismiss();
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't render if already installed or no prompt available
  if (isInstalled || !showPrompt) {
    return null;
  }

  return (
    <LazyAnimatePresence>
      {showPrompt && (
        <LazyMotionDiv
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className="relative rounded-lg border border-border bg-card p-6 shadow-2xl">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute right-2 top-2 rounded-full p-1 hover:bg-accent transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon */}
            <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
              {platform === 'mobile' ? (
                <Smartphone className="h-8 w-8 text-primary" />
              ) : (
                <Monitor className="h-8 w-8 text-primary" />
              )}
            </div>

            {/* Content */}
            <div className="text-center mb-4">
              <h3 className="text-[15px] font-semibold mb-2">
                Install E-Code
              </h3>
              <p className="text-[13px] text-muted-foreground">
                {platform === 'mobile'
                  ? 'Add E-Code to your home screen for quick access and offline support'
                  : 'Install E-Code as a desktop app for a native experience'}
              </p>
            </div>

            {/* Features */}
            <ul className="mb-4 space-y-2 text-[13px] text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Works offline</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Fast startup</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span>Native app experience</span>
              </li>
            </ul>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleInstall}
                className="w-full"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Install Now
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="w-full"
                size="sm"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </LazyMotionDiv>
      )}
    </LazyAnimatePresence>
  );
}

/**
 * iOS Install Instructions Component
 * iOS doesn't support beforeinstallprompt, so we show manual instructions
 */
export function IOSInstallInstructions() {
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS(iOS);
    setIsInStandaloneMode(standalone);

    // Check if user dismissed instructions
    const dismissed = localStorage.getItem('ios-install-dismissed');
    if (!dismissed && iOS && !standalone) {
      // Show after 45 seconds
      setTimeout(() => {
        setShowInstructions(true);
      }, 45000);
    }
  }, []);

  const handleDismiss = () => {
    setShowInstructions(false);
    localStorage.setItem('ios-install-dismissed', 'true');
  };

  if (!isIOS || isInStandaloneMode || !showInstructions) {
    return null;
  }

  return (
    <LazyAnimatePresence>
      <LazyMotionDiv
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm"
      >
        <div className="relative rounded-lg border border-border bg-card p-6 shadow-2xl">
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-2 rounded-full p-1 hover:bg-accent transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-center mb-4">
            <div className="mb-4 flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-[15px] font-semibold mb-2">
              Install E-Code on iOS
            </h3>
            <p className="text-[13px] text-muted-foreground">
              Add E-Code to your home screen for the best experience
            </p>
          </div>

          <ol className="space-y-3 text-[13px] text-left mb-4">
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-medium">
                1
              </span>
              <span>
                Tap the <strong>Share</strong> button in Safari
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-medium">
                2
              </span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-medium">
                3
              </span>
              <span>
                Tap <strong>Add</strong> in the top right corner
              </span>
            </li>
          </ol>

          <Button
            onClick={handleDismiss}
            variant="outline"
            className="w-full"
            size="sm"
          >
            Got it
          </Button>
        </div>
      </LazyMotionDiv>
    </LazyAnimatePresence>
  );
}
