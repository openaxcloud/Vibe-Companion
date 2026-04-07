import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Onboarding, type OnboardingStep } from '@/design-system/components/Onboarding';

const TOUR_STORAGE_KEY = 'e-code-ide-tour-completed';

const panelSelectors: Record<string, string> = {
  'file-explorer': '[data-panel="file-explorer"]',
  'code-editor': '[data-panel="editor"]',
  'terminal': '[data-panel="terminal"], [data-testid="replit-terminal-panel"]',
  'preview': '[data-panel="preview"]',
  'ai-agent': '[data-panel="agent"]',
  'deploy': '[data-panel="deploy"]',
};

function makeTourSteps(): OnboardingStep[] {
  return [
    {
      id: 'welcome',
      title: 'Welcome to E-Code IDE',
      description: 'Let us show you around the workspace. This quick tour highlights the key panels you\'ll use every day.',
      icon: '🚀',
    },
    {
      id: 'file-explorer',
      title: 'File Explorer',
      description: 'Browse and manage your project files. Create, rename, delete, and organize with drag-and-drop.',
      icon: '📁',
    },
    {
      id: 'code-editor',
      title: 'Code Editor',
      description: 'Full-featured Monaco editor with syntax highlighting, IntelliSense, and multi-cursor editing.',
      icon: '⌨️',
    },
    {
      id: 'terminal',
      title: 'Integrated Shell',
      description: 'Run commands, install packages, and manage your project. Full bash support with command history.',
      icon: '💻',
    },
    {
      id: 'preview',
      title: 'Live Preview',
      description: 'See your changes in real-time with the built-in browser preview and device emulator.',
      icon: '📱',
    },
    {
      id: 'ai-agent',
      title: 'AI Agent',
      description: 'Your AI pair programmer. Generate code, debug issues, and get intelligent suggestions.',
      icon: '🤖',
    },
    {
      id: 'deploy',
      title: 'One-Click Deploy',
      description: 'Deploy to production with a single click. Automatic SSL, CDN, and scaling. You\'re ready to build!',
      icon: '🚀',
    },
  ];
}

function useSpotlightRect(stepId: string) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    const selector = panelSelectors[stepId];
    if (!selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(selector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [stepId]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    const observer = new MutationObserver(() => requestAnimationFrame(updateRect));
    observer.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['style', 'class'],
    });
    return () => {
      window.removeEventListener('resize', updateRect);
      observer.disconnect();
    };
  }, [updateRect]);

  return rect;
}

interface IDEGuidedTourProps {
  onComplete: () => void;
  onActivatePanel?: (panelId: string) => void;
}

export function IDEGuidedTour({ onComplete, onActivatePanel }: IDEGuidedTourProps) {
  const steps = useMemo(() => makeTourSteps(), []);
  const [activeStepId, setActiveStepId] = useState('welcome');
  const cardRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(activeStepId);

  const spotlightRect = useSpotlightRect(activeStepId);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new MutationObserver(() => {
      const dots = card.querySelectorAll('button[aria-label^="Go to step"]');
      dots.forEach((dot, idx) => {
        const w = (dot as HTMLElement).getBoundingClientRect().width;
        if (w > 16 && steps[idx] && steps[idx].id !== prevStepRef.current) {
          const newId = steps[idx].id;
          prevStepRef.current = newId;
          setActiveStepId(newId);
          if (onActivatePanel && panelSelectors[newId]) {
            onActivatePanel(newId);
          }
        }
      });
    });

    observer.observe(card, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, [steps, onActivatePanel]);

  const pad = 8;

  return (
    <>
      {spotlightRect && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none' }}
          data-testid="spotlight-overlay"
        >
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={spotlightRect.left - pad}
                  y={spotlightRect.top - pad}
                  width={spotlightRect.width + pad * 2}
                  height={spotlightRect.height + pad * 2}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0" y="0" width="100%" height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: spotlightRect.left - pad,
              top: spotlightRect.top - pad,
              width: spotlightRect.width + pad * 2,
              height: spotlightRect.height + pad * 2,
              borderRadius: '8px',
              border: '2px solid rgba(242, 98, 7, 0.6)',
              boxShadow: '0 0 0 4px rgba(242, 98, 7, 0.15), 0 0 20px rgba(242, 98, 7, 0.2)',
            }}
          />
        </div>
      )}

      {!spotlightRect && activeStepId !== 'welcome' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            backgroundColor: 'rgba(0,0,0,0.55)', pointerEvents: 'none',
          }}
        />
      )}

      {activeStepId === 'welcome' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            backgroundColor: 'rgba(0,0,0,0.55)', pointerEvents: 'none',
          }}
        />
      )}

      <div
        ref={cardRef}
        data-testid="ide-guided-tour"
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          maxWidth: '92vw',
          zIndex: 10001,
          background: 'rgba(18, 18, 22, 0.96)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <style>{`
          [data-testid="ide-guided-tour"] > div {
            position: relative !important;
            inset: unset !important;
            top: unset !important;
            left: unset !important;
            right: unset !important;
            bottom: unset !important;
            background-color: transparent !important;
            z-index: auto !important;
          }
        `}</style>
        <Onboarding
          steps={steps}
          onComplete={onComplete}
          onSkip={onComplete}
          storageKey={TOUR_STORAGE_KEY}
        />
      </div>
    </>
  );
}

export function useIDETour() {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (completed !== 'true') {
      const timer = setTimeout(() => setShowTour(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setShowTour(true);
  }, []);

  const completeTour = useCallback(() => {
    setShowTour(false);
  }, []);

  return { showTour, startTour, completeTour };
}

export { TOUR_STORAGE_KEY };
