/**
 * Onboarding Flow
 * Beautiful first-time user experience with interactive tutorials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { LazyMotionDiv, LazyMotionButton, LazyAnimatePresence } from '@/lib/motion';
import { useDesignSystem } from '../hooks/useDesignSystem';
import { triggerHaptic } from '../hooks/useGestures';

// ============================================================================
// TYPES
// ============================================================================

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  illustration?: React.ReactNode;
  icon?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface OnboardingProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip?: () => void;
  storageKey?: string;
}

// ============================================================================
// ONBOARDING COMPONENT
// ============================================================================

export const Onboarding: React.FC<OnboardingProps> = ({
  steps,
  onComplete,
  onSkip,
  storageKey = 'e-code-onboarding-completed',
}) => {
  const ds = useDesignSystem();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  useEffect(() => {
    // Check if onboarding was already completed
    const completed = localStorage.getItem(storageKey);
    if (completed === 'true') {
      onComplete();
    }
  }, [storageKey, onComplete]);

  const handleNext = useCallback(() => {
    triggerHaptic('selection');
    if (isLastStep) {
      localStorage.setItem(storageKey, 'true');
      onComplete();
    } else {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, storageKey, onComplete]);

  const handlePrevious = useCallback(() => {
    triggerHaptic('selection');
    if (!isFirstStep) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleSkip = useCallback(() => {
    triggerHaptic('selection');
    localStorage.setItem(storageKey, 'true');
    if (onSkip) {
      onSkip();
    } else {
      onComplete();
    }
  }, [storageKey, onSkip, onComplete]);

  const handleDotPress = useCallback((index: number) => {
    triggerHaptic('selection');
    setDirection(index > currentStep ? 1 : -1);
    setCurrentStep(index);
  }, [currentStep]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: ds.zIndex.modal,
        backgroundColor: ds.colors.background.primary,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Skip button */}
      {onSkip && !isLastStep && (
        <div
          style={{
            position: 'absolute',
            top: `calc(${ds.spacing[5]} + env(safe-area-inset-top, 0px))`,
            right: ds.spacing[5],
            zIndex: 10,
          }}
        >
          <LazyMotionButton
            onClick={handleSkip}
            whileTap={{ scale: 0.95 }}
            style={{
              ...ds.typography.textStyles.callout,
              fontWeight: 600,
              padding: `${ds.spacing[3]} ${ds.spacing[5]}`,
              backgroundColor: 'transparent',
              color: ds.colors.text.secondary,
              border: 'none',
              cursor: 'pointer',
              minHeight: ds.touchTargets.min,
            }}
          >
            Skip
          </LazyMotionButton>
        </div>
      )}

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: ds.spacing[7],
          paddingTop: `calc(${ds.spacing[12]} + env(safe-area-inset-top, 0px))`,
          paddingBottom: `calc(${ds.spacing[12]} + env(safe-area-inset-bottom, 0px))`,
          overflow: 'hidden',
        }}
      >
        <LazyAnimatePresence mode="wait" custom={direction}>
          <LazyMotionDiv
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            style={{
              width: '100%',
              maxWidth: '500px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            {/* Illustration */}
            {step.illustration ? (
              <div style={{ marginBottom: ds.spacing[8] }}>
                {step.illustration}
              </div>
            ) : step.icon ? (
              <div
                style={{
                  fontSize: '80px',
                  marginBottom: ds.spacing[8],
                  opacity: 0.9,
                }}
              >
                {step.icon}
              </div>
            ) : null}

            {/* Title */}
            <h1
              style={{
                ...ds.typography.textStyles.largeTitle,
                color: ds.colors.text.primary,
                marginBottom: ds.spacing[4],
                margin: `0 0 ${ds.spacing[4]} 0`,
              }}
            >
              {step.title}
            </h1>

            {/* Description */}
            <p
              style={{
                ...ds.typography.textStyles.body,
                color: ds.colors.text.secondary,
                marginBottom: step.action ? ds.spacing[7] : 0,
                margin: step.action ? `0 0 ${ds.spacing[7]} 0` : 0,
                maxWidth: '400px',
              }}
            >
              {step.description}
            </p>

            {/* Step-specific action */}
            {step.action && (
              <LazyMotionButton
                onClick={step.action.onPress}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                style={{
                  ...ds.typography.textStyles.callout,
                  fontWeight: 600,
                  padding: `${ds.spacing[4]} ${ds.spacing[7]}`,
                  backgroundColor: ds.colors.interactive.primary,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: ds.borderRadius.lg,
                  cursor: 'pointer',
                  minHeight: ds.touchTargets.min,
                  boxShadow: ds.shadows.md,
                }}
              >
                {step.action.label}
              </LazyMotionButton>
            )}
          </LazyMotionDiv>
        </LazyAnimatePresence>
      </div>

      {/* Progress dots */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: ds.spacing[3],
          padding: ds.spacing[5],
        }}
      >
        {steps.map((_, index) => (
          <LazyMotionButton
            key={index}
            onClick={() => handleDotPress(index)}
            whileTap={{ scale: 0.9 }}
            style={{
              width: index === currentStep ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              backgroundColor:
                index === currentStep
                  ? ds.colors.interactive.primary
                  : ds.colors.fill.tertiary,
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.3s ease',
            }}
            aria-label={`Go to step ${index + 1}`}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: ds.spacing[5],
          paddingBottom: `calc(${ds.spacing[5]} + env(safe-area-inset-bottom, 0px))`,
          gap: ds.spacing[4],
        }}
      >
        <LazyMotionButton
          onClick={handlePrevious}
          disabled={isFirstStep}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          style={{
            ...ds.typography.textStyles.callout,
            fontWeight: 600,
            flex: 1,
            padding: `${ds.spacing[4]} ${ds.spacing[6]}`,
            backgroundColor: ds.colors.fill.secondary,
            color: ds.colors.text.primary,
            border: 'none',
            borderRadius: ds.borderRadius.lg,
            cursor: isFirstStep ? 'not-allowed' : 'pointer',
            minHeight: ds.touchTargets.min,
            opacity: isFirstStep ? 0.4 : 1,
          }}
        >
          Previous
        </LazyMotionButton>

        <LazyMotionButton
          onClick={handleNext}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          style={{
            ...ds.typography.textStyles.callout,
            fontWeight: 600,
            flex: 1,
            padding: `${ds.spacing[4]} ${ds.spacing[6]}`,
            backgroundColor: ds.colors.interactive.primary,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: ds.borderRadius.lg,
            cursor: 'pointer',
            minHeight: ds.touchTargets.min,
            boxShadow: ds.shadows.md,
          }}
        >
          {isLastStep ? 'Get Started' : 'Next'}
        </LazyMotionButton>
      </div>
    </div>
  );
};

// ============================================================================
// DEFAULT ONBOARDING STEPS FOR E-CODE IDE
// ============================================================================

export const defaultOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to E-Code',
    description:
      'A powerful mobile IDE that lets you code anywhere, anytime. Build, run, and deploy your projects from your phone or tablet.',
    icon: '👋',
  },
  {
    id: 'editor',
    title: 'Professional Code Editor',
    description:
      'Full-featured Monaco editor with syntax highlighting, auto-completion, and support for multiple languages. Optimized for touch with pinch-to-zoom and gestures.',
    icon: '⌨️',
  },
  {
    id: 'terminal',
    title: 'Integrated Terminal',
    description:
      'Run commands, install packages, and manage your project directly from the terminal. Full bash support with command history.',
    icon: '💻',
  },
  {
    id: 'preview',
    title: 'Live Preview',
    description:
      'See your changes instantly with live preview. Test on different device sizes with our device emulator.',
    icon: '📱',
  },
  {
    id: 'git',
    title: 'Git Integration',
    description:
      'Manage your repositories with built-in Git support. Commit, push, pull, and resolve conflicts right from your mobile device.',
    icon: '🔀',
  },
  {
    id: 'collaboration',
    title: 'AI-Powered Development',
    description:
      'Get intelligent code suggestions and assistance from our AI agent. Let AI help you write better code faster.',
    icon: '🤖',
  },
];

// ============================================================================
// FEATURE SPOTLIGHT (In-app tutorials)
// ============================================================================

export interface SpotlightProps {
  targetRef?: React.RefObject<HTMLElement>;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onClose: () => void;
  onNext?: () => void;
}

export const FeatureSpotlight: React.FC<SpotlightProps> = ({
  targetRef,
  title,
  description,
  position = 'bottom',
  onClose,
  onNext,
}) => {
  const ds = useDesignSystem();
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
      });
    }
  }, [targetRef]);

  return (
    <>
      {/* Backdrop */}
      <LazyMotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: ds.zIndex.modal,
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Tooltip */}
      <LazyMotionDiv
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
        style={{
          position: 'absolute',
          top: position === 'bottom' ? coords.top + 60 : coords.top - 120,
          left: coords.left,
          zIndex: ds.zIndex.modal + 1,
          maxWidth: '300px',
          padding: ds.spacing[5],
          backgroundColor: ds.colors.background.elevated,
          borderRadius: ds.borderRadius.lg,
          boxShadow: ds.shadows.xl,
          backdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <h3
          style={{
            ...ds.typography.textStyles.headline,
            color: ds.colors.text.primary,
            marginBottom: ds.spacing[3],
            margin: `0 0 ${ds.spacing[3]} 0`,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            ...ds.typography.textStyles.callout,
            color: ds.colors.text.secondary,
            marginBottom: ds.spacing[5],
            margin: `0 0 ${ds.spacing[5]} 0`,
          }}
        >
          {description}
        </p>
        <div style={{ display: 'flex', gap: ds.spacing[3], justifyContent: 'flex-end' }}>
          <LazyMotionButton
            onClick={onClose}
            whileTap={{ scale: 0.95 }}
            style={{
              ...ds.typography.textStyles.callout,
              fontWeight: 600,
              padding: `${ds.spacing[3]} ${ds.spacing[5]}`,
              backgroundColor: 'transparent',
              color: ds.colors.text.secondary,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {onNext ? 'Skip' : 'Got it'}
          </LazyMotionButton>
          {onNext && (
            <LazyMotionButton
              onClick={onNext}
              whileTap={{ scale: 0.95 }}
              style={{
                ...ds.typography.textStyles.callout,
                fontWeight: 600,
                padding: `${ds.spacing[3]} ${ds.spacing[5]}`,
                backgroundColor: ds.colors.interactive.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: ds.borderRadius.md,
                cursor: 'pointer',
              }}
            >
              Next
            </LazyMotionButton>
          )}
        </div>
      </LazyMotionDiv>
    </>
  );
};

export default Onboarding;
